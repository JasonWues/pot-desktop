import { readTextFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import { Dropdown, Button, Input, Avatar, Tooltip, Label, TextField } from '@heroui/react';
import { Section, Row } from '../../components/Section';

import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { warn } from '@tauri-apps/plugin-log';
import React, { useEffect, useState } from 'react';

import { useConfig, useToastStyle, useDisclosure } from '../../../../hooks';
import { osType } from '../../../../utils/env';
import * as webdav from './utils/webdav';
import WebDavModal from './WebDavModal';
import AliyunModal from './AliyunModal';
import * as local from './utils/local';
import * as aliyun from './utils/aliyun';

let refreshTimer = null;

export default function Backup() {
    const [backupType, setBackupType] = useConfig('backup_type', 'webdav');
    const [davUserName, setDavUserName] = useConfig('webdav_username', '');
    const [davPassword, setDavPassword] = useConfig('webdav_password', '');
    const [davUrl, setDavUrl] = useConfig('webdav_url', '');
    const [aliyunQrCodeUrl, setAliyunQrCodeUrl] = useState('');
    const [aliyunUserInfo, setAliyunUserInfo] = useState(null);
    const [aliyunAccessToken, setAliyunAccessToken] = useConfig('aliyun_access_token', '');
    // const [aliyunRefreshToken, setAliyunRefreshToken] = useConfig('aliyun_refresh_token', '');
    const {
        isOpen: isWebDavListOpen,
        onOpen: onWebDavListOpen,
        onOpenChange: onWebDavListOpenChange,
    } = useDisclosure();
    const {
        isOpen: isAliyunListOpen,
        onOpen: onAliyunListOpen,
        onOpenChange: onAliyunListOpenChange,
    } = useDisclosure();
    const [uploading, setUploading] = useState(false);
    const toastStyle = useToastStyle();
    const { t } = useTranslation();

    const onBackup = async () => {
        setUploading(true);
        const time = new Date();
        const fileName = `${osType}-${time.getFullYear()}-${
            time.getMonth() + 1
        }-${time.getDate()}-${time.getHours()}-${time.getMinutes()}-${time.getSeconds()}`;

        let result;
        switch (backupType) {
            case 'webdav':
                result = webdav.backup(davUrl, davUserName, davPassword, fileName + '.zip');
                break;
            case 'local':
                result = local.backup(fileName);
                break;
            case 'aliyun':
                if (aliyunAccessToken === '') {
                    toast.error(t('config.backup.aliyun_login_first'), { style: toastStyle });
                    setUploading(false);
                } else {
                    result = aliyun.backup(aliyunAccessToken, fileName + '.zip');
                }
                break;
            default:
                warn('Unknown backup type');
                return;
        }
        result.then(
            () => {
                toast.success(t('config.backup.backup_success'), { style: toastStyle });
                setUploading(false);
            },
            (e) => {
                toast.error(e.toString(), { style: toastStyle });
                setUploading(false);
            }
        );
    };

    const onBackupListOpen = () => {
        switch (backupType) {
            case 'webdav':
                onWebDavListOpen();
                break;
            case 'local':
                local.get().then(
                    () => {
                        toast.success(t('config.backup.load_success'), { style: toastStyle });
                    },
                    (e) => {
                        toast.error(e.toString(), { style: toastStyle });
                    }
                );
                break;
            case 'aliyun':
                if (aliyunAccessToken === '') {
                    toast.error(t('config.backup.aliyun_login_first'), { style: toastStyle });
                } else {
                    onAliyunListOpen();
                }

                break;
            default:
                warn('Unknown backup type');
        }
    };

    const pollingStatus = async (sid) => {
        refreshTimer = setInterval(async () => {
            try {
                const { status, code } = await aliyun.status(sid);
                switch (status) {
                    case 'QRCodeExpired': {
                        refreshQrCode();
                        break;
                    }
                    case 'LoginSuccess': {
                        clearInterval(refreshTimer);
                        toast.success(t('config.backup.login_success'), { style: toastStyle });
                        const token = await aliyun.accessToken(code);
                        setAliyunAccessToken(token);
                        await refreshUserInfo(token);
                        break;
                    }
                }
            } catch (e) {
                toast.error(e.toString(), { style: toastStyle });
                refreshQrCode();
            }
        }, 2000);
    };

    const refreshQrCode = async () => {
        try {
            const { url, sid } = await aliyun.qrcode();
            setAliyunQrCodeUrl(url);
            if (refreshTimer) {
                clearInterval(refreshTimer);
            }
            pollingStatus(sid);
        } catch (e) {
            setAliyunQrCodeUrl('');
            toast.error(e.toString(), { style: toastStyle });
        }
    };

    const refreshUserInfo = async (token) => {
        try {
            const info = await aliyun.userInfo(token);
            setAliyunQrCodeUrl('');
            setAliyunUserInfo(info);
        } catch (e) {
            toast.error(e.toString(), { style: toastStyle });
            setAliyunAccessToken('');
            refreshQrCode();
        }
    };

    useEffect(() => {
        if (backupType === null || backupType !== 'aliyun') return;
        if (aliyunAccessToken === '') {
            refreshQrCode();
        } else {
            refreshUserInfo(aliyunAccessToken);
        }

        return () => {
            clearInterval(refreshTimer);
        };
    }, [backupType]);

    return (
        <>
            <Section
                name={t('config.backup.section.target')}
                note={t('config.backup.section.target_note')}
            >
                <Row
                    label={t('config.backup.type')}
                    desc={t('config.backup.type_desc')}
                >
                    {backupType !== null && (
                        <Dropdown>
                            <Button variant='outline'>{t(`config.backup.${backupType}`)}</Button>
                            <Dropdown.Popover>
                                <Dropdown.Menu
                                    aria-label='backup type'
                                    onAction={(key) => {
                                        setBackupType(key);
                                    }}
                                >
                                    <Dropdown.Item
                                        key='webdav'
                                        id='webdav'
                                    >
                                        <Label>{t('config.backup.webdav')}</Label>
                                    </Dropdown.Item>
                                    <Dropdown.Item
                                        key='aliyun'
                                        id='aliyun'
                                    >
                                        <Label>{t('config.backup.aliyun')}</Label>
                                    </Dropdown.Item>
                                    <Dropdown.Item
                                        key='local'
                                        id='local'
                                    >
                                        <Label>{t('config.backup.local')}</Label>
                                    </Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown.Popover>
                        </Dropdown>
                    )}
                </Row>
                <div className={backupType !== 'webdav' ? 'hidden' : ''}>
                    {/* aria-label rather than a <Label> child, for all three rows below.
                        These already name themselves with the <h3> to their left; v2 named
                        them twice too, but its `label` prop defaulted to `labelPlacement:
                        'inside'`, so the second copy floated inside the empty field as a
                        placeholder and vanished on input. v3's Label is a real sibling
                        element, which put a second full-size label between the heading and
                        the box. */}
                    <Row
                        label={t('config.backup.webdav_url')}
                        desc={t('config.backup.webdav_url_desc')}
                    >
                        {davUrl !== null && (
                            <TextField
                                aria-label={t('config.backup.webdav_url')}
                                className='w-[300px]'
                                value={davUrl}
                                onChange={(v) => {
                                    setDavUrl(v);
                                }}
                            >
                                <Input />
                            </TextField>
                        )}
                    </Row>
                    <Row
                        label={t('config.backup.username')}
                        desc={t('config.backup.webdav_username_desc')}
                    >
                        {davUserName !== null && (
                            <TextField
                                aria-label={t('config.backup.username')}
                                className='w-[300px]'
                                value={davUserName}
                                onChange={(v) => {
                                    setDavUserName(v);
                                }}
                            >
                                <Input />
                            </TextField>
                        )}
                    </Row>
                    <Row
                        label={t('config.backup.password')}
                        desc={t('config.backup.webdav_password_desc')}
                    >
                        {davPassword !== null && (
                            <TextField
                                aria-label={t('config.backup.password')}
                                className='w-[300px]'
                                value={davPassword}
                                onChange={(v) => {
                                    setDavPassword(v);
                                }}
                            >
                                <Input type='password' />
                            </TextField>
                        )}
                    </Row>
                </div>
                <div className={`flat-row justify-center ${backupType !== 'aliyun' ? 'hidden' : ''}`}>
                    <img
                        src={aliyunQrCodeUrl}
                        className={`h-[200px] mb-2 ${aliyunQrCodeUrl === '' ? 'hidden' : ''}`}
                    />
                </div>
                {aliyunUserInfo !== null && (
                    <Row
                        className={backupType !== 'aliyun' ? 'hidden' : ''}
                        label={t('config.backup.username')}
                        desc={t('config.backup.aliyun_account_desc')}
                    >
                        <Tooltip>
                            <Tooltip.Trigger>
                                <Button
                                    variant='tertiary'
                                    onClick={() => {
                                        setAliyunAccessToken('');
                                        // setAliyunRefreshToken('');
                                        setAliyunUserInfo(null);
                                        refreshQrCode();
                                    }}
                                >
                                    <Avatar
                                        src={aliyunUserInfo.avatar}
                                        size='sm'
                                    />
                                    <h3 className='my-auto'>{aliyunUserInfo.name}</h3>
                                </Button>
                            </Tooltip.Trigger>
                            <Tooltip.Content placement='bottom-end'>{t('config.backup.logout')}</Tooltip.Content>
                        </Tooltip>
                    </Row>
                )}
            </Section>
            <div className='flat-foot'>
                <Button
                    variant='tertiary'
                    isPending={uploading}
                    onPress={onBackup}
                >
                    {t('config.backup.backup')}
                </Button>
                <Button
                    variant='tertiary'
                    onPress={onBackupListOpen}
                >
                    {t('config.backup.restore')}
                </Button>
            </div>
            <WebDavModal
                isOpen={isWebDavListOpen}
                onOpenChange={onWebDavListOpenChange}
                url={davUrl}
                username={davUserName}
                password={davPassword}
            />
            <AliyunModal
                isOpen={isAliyunListOpen}
                onOpenChange={onAliyunListOpenChange}
                accessToken={aliyunAccessToken}
                // refreshToken={aliyunRefreshToken}
            />
        </>
    );
}
