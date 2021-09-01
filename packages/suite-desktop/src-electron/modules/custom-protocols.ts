/**
 * Support custom protocols (for example: `bitcoin:`)
 */
import { isValidProtocol } from '@desktop-electron/libs/protocol';
import { app } from 'electron';

const init = ({ mainWindow }: Dependencies) => {
    const { logger } = global;

    const protocols = process.env.PROTOCOLS as unknown as string[];
    protocols.forEach((p: string) => app.setAsDefaultProtocolClient(p));

    const sendProtocolInfo = (protocol: string) => {
        if (isValidProtocol(protocol, protocols)) {
            logger.debug('custom-protocols', `Protocol send to browser window. ${protocol}`);
            mainWindow.webContents.send('protocol/open', protocol);
        }
    };

    // App is launched via custom protocol (Linux, Windows)
    if (process.argv[1]) {
        logger.debug('custom-protocols', 'App launched via custom protocol (Linux, Windows).');
        mainWindow.webContents.on('did-finish-load', () => {
            sendProtocolInfo(process.argv[1]);
        });
    }

    // App is launched via custom protocol (macOS)
    app.on('will-finish-launching', () => {
        logger.debug(
            'custom-protocols',
            'App launched via custom protocol (macOS). Stage: will-finish-launching',
        );

        app.on('open-url', (event, url) => {
            logger.debug(
                'custom-protocols',
                'App launched via custom protocol (macOS). Stage: open-url',
            );

            event.preventDefault();
            mainWindow.webContents.on('did-finish-load', () => {
                logger.debug(
                    'custom-protocols',
                    'App launched via custom protocol (macOS). Stage: did-finish-load',
                );

                sendProtocolInfo(url);
            });
        });
    });

    // App is running and custom protocol was activated (macOS)
    app.on('open-url', (event, url) => {
        logger.debug('custom-protocols', 'Handle custom protocol (macOS). Stage: open-url');

        event.preventDefault();
        if (mainWindow.isMinimized()) {
            mainWindow.restore();
        } else {
            mainWindow.focus();
        }

        sendProtocolInfo(url);
    });
};

export default init;
