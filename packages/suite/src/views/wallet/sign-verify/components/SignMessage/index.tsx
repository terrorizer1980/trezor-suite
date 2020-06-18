import React, { useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { Input, Button, Textarea, Select, variables } from '@trezor/components';
import { Card, Translation } from '@suite-components';
import { useForm, Controller } from 'react-hook-form';
import { ChildProps as Props } from '../../Container';
import { useActions } from '@suite-hooks';
import * as signVerifyActions from '@wallet-actions/signVerifyActions';
import * as modalActions from '@suite-actions/modalActions';

const AppearAnimation = keyframes`
 0% { opacity: 0; }
 10% { opacity: 0.1; }
 30% { opacity: 0.3; }
 70% {  opacity: 0.7;}
 80% {  opacity: 0.8;}
 90% {  opacity: 0.9;}
 100% { opacity: 1; }
`;

const Column = styled.div`
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    animation-name: ${AppearAnimation};
    animation-duration: 0.6s;
    animation-iteration-count: 1;
    @media screen and (max-width: ${variables.SCREEN_SIZE.MD}) {
        flex: 1 1 100%;
    }
`;

const StyledSelect = styled(Select)`
    padding: 0;
    margin-bottom: 0px;
    @media screen and (max-width: ${variables.SCREEN_SIZE.SM}) {
        font-size: ${variables.FONT_SIZE.TINY};
    }
`;

const Row = styled.div`
    padding-bottom: 28px;
    display: flex;
`;
const RowButtons = styled(Row)`
    display: flex;
    align-items: center;
    justify-content: flex-end;
`;
const StyledButton = styled(Button)`
    width: 110px;
    margin-left: 10px;

    &:first-child {
        margin-left: 0;
    }
`;
const LeftSideButton = styled(StyledButton)`
    margin-right: auto;
`;

interface AddressToSign {
    address: string;
    path: string;
    accountsSelectOpt?: Array<{ label: string; value: string }>;
}
type errorsMessage = 'TR_ADDRESS_IS_NOT_VALID' | 'TR_REQUIRED_FIELD';
type Inputs = {
    address: string;
    path: string;
    signMessage: string;
    accountsSelect: { label: string; value: string; type: '' };
    signature: string;
};

let path: AddressToSign['address'] = ''; // fast click on copy button failed if put this inside a component
let address: AddressToSign['path'] = '';
let accountsSelectOpt: AddressToSign['accountsSelectOpt'];

const SignMessage = ({ account, isLocked }: Props) => {
    const { sign, openModal } = useActions({
        sign: signVerifyActions.sign,
        openModal: modalActions.openModal,
    });
    if (
        account.networkType === 'bitcoin' &&
        typeof account.addresses?.unused[0]?.address === 'string' &&
        typeof account.addresses?.unused[0]?.path === 'string'
    ) {
        const accountsSelectArr = [...account.addresses.unused, ...account.addresses.used];
        accountsSelectOpt = accountsSelectArr.map(el => ({
            label: el.address,
            value: el.path,
        }));
    } else if (account.networkType === 'ethereum') {
        address = account.descriptor;
        path = account.path;
    }

    const { getValues, setValue, errors, formState, reset, control, register, watch } = useForm<
        Inputs
    >({
        defaultValues: {
            address,
            path,
            signMessage: '',
            accountsSelect: { label: '', value: '', type: '' },
            signature: '',
        },
        mode: 'onChange',
    });
    const { isValid } = formState;
    const watchSignature = watch('signature');

    useEffect(() => {
        return () => {
            reset(); // clear data after coin change
            path = '';
            address = '';
        };
    }, [reset]);

    return (
        <Card title={<Translation id="TR_SIGN_MESSAGE" />} isColumn>
            <Column>
                <Row>
                    {account.networkType === 'bitcoin' && (
                        <Controller
                            as={<StyledSelect options={accountsSelectOpt} />}
                            control={control}
                            topLabel={<Translation id="TR_ADDRESS" />}
                            name="accountsSelect"
                            state={errors.accountsSelect ? 'error' : undefined}
                            onChange={([selected]) => {
                                path = selected.value;
                                address = selected.label;
                                return selected;
                            }}
                            bottomText={
                                errors.accountsSelect && (
                                    <Translation
                                        id={(errors.accountsSelect.type as any) as errorsMessage}
                                    />
                                )
                            }
                            rules={{
                                validate: {
                                    TR_REQUIRED_FIELD: (selectValue: Inputs['accountsSelect']) => {
                                        return selectValue.value.length > 0;
                                    },
                                },
                            }}
                        />
                    )}
                    {/* input is more convenient from the ability to select and copy */}
                    {account.networkType === 'ethereum' && (
                        <Input
                            topLabel={<Translation id="TR_ADDRESS" />}
                            name="address"
                            value={address}
                            type="text"
                            innerRef={register}
                            readOnly
                        />
                    )}
                </Row>
                <Row>
                    <Textarea
                        topLabel={<Translation id="TR_MESSAGE" />}
                        name="signMessage"
                        rows={4}
                        maxRows={4}
                        maxLength={255}
                        onChange={() => {
                            setValue('signature', ''); // reset signature if user changes the message
                        }}
                        state={errors.signMessage ? 'error' : undefined}
                        bottomText={
                            errors.signMessage && (
                                <Translation id={errors.signMessage.type as errorsMessage} />
                            )
                        }
                        innerRef={register({
                            validate: {
                                TR_REQUIRED_FIELD: (value: string) => {
                                    return value.length > 0;
                                },
                            },
                        })}
                    />
                </Row>
                <Row>
                    <Textarea
                        topLabel={<Translation id="TR_SIGNATURE" />}
                        name="signature"
                        rows={4}
                        maxRows={4}
                        maxLength={255}
                        innerRef={register}
                        readOnly
                    />
                </Row>
                <RowButtons>
                    {watchSignature && (
                        <LeftSideButton
                            onClick={() => {
                                openModal({
                                    type: 'review-signed-message',
                                    signedObj: {
                                        address,
                                        message: getValues('signMessage'),
                                        signature: getValues('signature'),
                                    },
                                });
                            }}
                            variant="secondary"
                        >
                            <Translation id="TR_COPY_SIGN_RESULTS" />
                        </LeftSideButton>
                    )}

                    <StyledButton
                        onClick={() => {
                            reset();
                            path = '';
                            address = '';
                        }}
                        variant="secondary"
                    >
                        <Translation id="TR_CLEAR" />
                    </StyledButton>
                    <StyledButton
                        isDisabled={isLocked() || !isValid}
                        onClick={async () => {
                            const responseSign = await sign(getValues('signMessage'), path);
                            if (typeof responseSign === 'string') {
                                setValue('signature', responseSign);
                            }
                        }}
                    >
                        <Translation id="TR_SIGN" />
                    </StyledButton>
                </RowButtons>
            </Column>
        </Card>
    );
};

export default SignMessage;