import { enable, isEnabled, disable } from '@tauri-apps/plugin-autostart';
import { DropdownTrigger } from '@heroui/react';
import React, { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { DropdownMenu } from '@heroui/react';
import { DropdownItem } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { CardBody } from '@heroui/react';
import { Dropdown } from '@heroui/react';
import { info } from '@tauri-apps/plugin-log';
import { Button } from '@heroui/react';
import { Switch } from '@heroui/react';
import { Input } from '@heroui/react';
import { Card } from '@heroui/react';
import { LuSun, LuMoon, LuMonitor, LuSparkles } from 'react-icons/lu';
import { invoke } from '@tauri-apps/api/core';
import { useTheme } from 'next-themes';

import { useConfig } from '../../../../hooks/useConfig';
import { LanguageFlag } from '../../../../utils/language';
import Flag from '../../../../components/Flag';
import { themeOptions } from '../../../../utils/theme';
import { useToastStyle } from '../../../../hooks';
import { osType } from '../../../../utils/env';

// react-icons ships the Lucide set as `lu`, so the icons cost no extra
// dependency. Keyed by the same names as `themeOptions`.
const themeIcon = {
    system: LuMonitor,
    light: LuSun,
    dark: LuMoon,
    nocturne: LuSparkles,
};

function ThemeIcon({ name }) {
    const Icon = themeIcon[name] ?? LuMonitor;
    return <Icon className='text-[16px]' />;
}

let timer = null;

export default function General() {
    const [autoStart, setAutoStart] = useState(false);
    const [fontList, setFontList] = useState(null);
    const [checkUpdate, setCheckUpdate] = useConfig('check_update', true);
    const [serverPort, setServerPort] = useConfig('server_port', 60828);
    const [appLanguage, setAppLanguage] = useConfig('app_language', 'en');
    const [appTheme, setAppTheme] = useConfig('app_theme', 'system');
    const [appFont, setAppFont] = useConfig('app_font', 'default');
    const [appFallbackFont, setAppFallbackFont] = useConfig('app_fallback_font', 'default');
    const [appFontSize, setAppFontSize] = useConfig('app_font_size', 16);
    const [transparent, setTransparent] = useConfig('transparent', true);
    const [devMode, setDevMode] = useConfig('dev_mode', false);
    const [trayClickEvent, setTrayClickEvent] = useConfig('tray_click_event', 'config');
    const [proxyMode, setProxyMode] = useConfig('proxy_mode', 'system');
    const [proxyHost, setProxyHost] = useConfig('proxy_host', '');
    const [proxyPort, setProxyPort] = useConfig('proxy_port', '');
    const [proxyUsername, setProxyUsername] = useConfig('proxy_username', '');
    const [proxyPassword, setProxyPassword] = useConfig('proxy_password', '');
    const [noProxy, setNoProxy] = useConfig('no_proxy', 'localhost,127.0.0.1');
    const [systemProxy, setSystemProxy] = useState(null);
    const { t, i18n } = useTranslation();
    const { setTheme } = useTheme();
    const toastStyle = useToastStyle();

    const languageName = {
        zh_cn: '简体中文',
        zh_tw: '繁體中文',
        en: 'English',
        ja: '日本語',
        ko: '한국어',
        fr: 'Français',
        es: 'Español',
        ru: 'Русский',
        de: 'Deutsch',
        it: 'Italiano',
        tr: 'Türkçe',
        pt_pt: 'Português',
        pt_br: 'Português (Brasil)',
        nb_no: 'Norsk Bokmål',
        nn_no: 'Norsk Nynorsk',
        fa: 'فارسی',
        uk: 'Українська',
        ar: 'العربية',
        he: 'עִבְרִית',
    };

    useEffect(() => {
        isEnabled().then((v) => {
            setAutoStart(v);
        });
        invoke('font_list').then((v) => {
            setFontList(v);
        });
    }, []);

    // Only worth reading while the system is the thing being followed; in the other
    // two modes what the OS thinks is not what the requests will do.
    useEffect(() => {
        if (proxyMode !== 'system') {
            setSystemProxy(null);
            return;
        }
        invoke('get_system_proxy').then(setSystemProxy);
    }, [proxyMode]);

    return (
        <>
            <Toaster />
            <Card className='mb-[10px]'>
                <CardBody>
                    <div className='config-item'>
                        <h3>{t('config.general.auto_start')}</h3>
                        <Switch
                            isSelected={autoStart}
                            onValueChange={(v) => {
                                setAutoStart(v);
                                if (v) {
                                    enable().then(() => {
                                        info('Auto start enabled');
                                    });
                                } else {
                                    disable().then(() => {
                                        info('Auto start disabled');
                                    });
                                }
                            }}
                        />
                    </div>
                    <div className='config-item'>
                        <h3>{t('config.general.check_update')}</h3>
                        {checkUpdate !== null && (
                            <Switch
                                isSelected={checkUpdate}
                                onValueChange={(v) => {
                                    setCheckUpdate(v);
                                }}
                            />
                        )}
                    </div>
                    <div className='config-item'>
                        <h3 className='my-auto'>{t('config.general.server_port')}</h3>
                        {serverPort !== null && (
                            <Input
                                type='number'
                                variant='bordered'
                                value={serverPort}
                                labelPlacement='outside-left'
                                onValueChange={(v) => {
                                    if (parseInt(v) !== serverPort) {
                                        if (timer) {
                                            clearTimeout(timer);
                                        }
                                        timer = setTimeout(() => {
                                            toast.success(t('config.general.server_port_change'), {
                                                duration: 3000,
                                                style: toastStyle,
                                            });
                                        }, 1000);
                                    }
                                    if (v === '') {
                                        setServerPort(0);
                                    } else if (parseInt(v) > 65535) {
                                        setServerPort(65535);
                                    } else if (parseInt(v) < 0) {
                                        setServerPort(0);
                                    } else {
                                        setServerPort(parseInt(v));
                                    }
                                }}
                                className='max-w-[100px]'
                            />
                        )}
                    </div>
                </CardBody>
            </Card>
            <Card className='mb-[10px]'>
                <CardBody>
                    <div className='config-item'>
                        <h3 className='my-auto'>{t('config.general.app_language')}</h3>
                        {appLanguage !== null && (
                            <Dropdown>
                                <DropdownTrigger>
                                    <Button
                                        variant='bordered'
                                        startContent={<Flag code={LanguageFlag[appLanguage]} />}
                                    >
                                        {languageName[appLanguage]}
                                    </Button>
                                </DropdownTrigger>
                                <DropdownMenu
                                    aria-label='app language'
                                    className='max-h-[40vh] overflow-y-auto'
                                    onAction={(key) => {
                                        setAppLanguage(key);
                                        i18n.changeLanguage(key);
                                        invoke('update_tray', { language: key, copyMode: '' });
                                    }}
                                >
                                    <DropdownItem
                                        key='zh_cn'
                                        startContent={<Flag code={LanguageFlag.zh_cn} />}
                                    >
                                        简体中文
                                    </DropdownItem>
                                    <DropdownItem
                                        key='zh_tw'
                                        startContent={<Flag code={LanguageFlag.zh_cn} />}
                                    >
                                        繁體中文
                                    </DropdownItem>
                                    <DropdownItem
                                        key='en'
                                        startContent={<Flag code={LanguageFlag.en} />}
                                    >
                                        English
                                    </DropdownItem>
                                    <DropdownItem
                                        key='ja'
                                        startContent={<Flag code={LanguageFlag.ja} />}
                                    >
                                        日本語
                                    </DropdownItem>
                                    <DropdownItem
                                        key='ko'
                                        startContent={<Flag code={LanguageFlag.ko} />}
                                    >
                                        한국어
                                    </DropdownItem>
                                    <DropdownItem
                                        key='fr'
                                        startContent={<Flag code={LanguageFlag.fr} />}
                                    >
                                        Français
                                    </DropdownItem>
                                    <DropdownItem
                                        key='de'
                                        startContent={<Flag code={LanguageFlag.de} />}
                                    >
                                        Deutsch
                                    </DropdownItem>
                                    <DropdownItem
                                        key='es'
                                        startContent={<Flag code={LanguageFlag.es} />}
                                    >
                                        Español
                                    </DropdownItem>
                                    <DropdownItem
                                        key='ru'
                                        startContent={<Flag code={LanguageFlag.ru} />}
                                    >
                                        Русский
                                    </DropdownItem>
                                    <DropdownItem
                                        key='it'
                                        startContent={<Flag code={LanguageFlag.it} />}
                                    >
                                        Italiano
                                    </DropdownItem>
                                    <DropdownItem
                                        key='tr'
                                        startContent={<Flag code={LanguageFlag.tr} />}
                                    >
                                        Türkçe
                                    </DropdownItem>
                                    <DropdownItem
                                        key='pt_pt'
                                        startContent={<Flag code={LanguageFlag.pt_pt} />}
                                    >
                                        Português
                                    </DropdownItem>
                                    <DropdownItem
                                        key='pt_br'
                                        startContent={<Flag code={LanguageFlag.pt_br} />}
                                    >
                                        Português (Brasil)
                                    </DropdownItem>
                                    <DropdownItem
                                        key='nb_no'
                                        startContent={<Flag code={LanguageFlag.nb_no} />}
                                    >
                                        Norsk Bokmål
                                    </DropdownItem>
                                    <DropdownItem
                                        key='nn_no'
                                        startContent={<Flag code={LanguageFlag.nn_no} />}
                                    >
                                        Norsk Nynorsk
                                    </DropdownItem>
                                    <DropdownItem
                                        key='fa'
                                        startContent={<Flag code={LanguageFlag.fa} />}
                                    >
                                        فارسی
                                    </DropdownItem>
                                    <DropdownItem
                                        key='uk'
                                        startContent={<Flag code={LanguageFlag.uk} />}
                                    >
                                        Українська
                                    </DropdownItem>
                                    <DropdownItem
                                        key='ar'
                                        startContent={<Flag code={LanguageFlag.ar} />}
                                    >
                                        العربية
                                    </DropdownItem>
                                    <DropdownItem
                                        key='he'
                                        startContent={<Flag code={LanguageFlag.he} />}
                                    >
                                        עִבְרִית
                                    </DropdownItem>
                                </DropdownMenu>
                            </Dropdown>
                        )}
                    </div>
                    <div className='config-item'>
                        <h3 className='my-auto'>{t('config.general.app_theme')}</h3>
                        {appTheme !== null && (
                            <Dropdown>
                                <DropdownTrigger>
                                    <Button
                                        variant='bordered'
                                        startContent={<ThemeIcon name={appTheme} />}
                                    >
                                        {t(`config.general.theme.${appTheme}`)}
                                    </Button>
                                </DropdownTrigger>
                                <DropdownMenu
                                    aria-label='app theme'
                                    onAction={(key) => {
                                        setAppTheme(key);
                                        if (key !== 'system') {
                                            setTheme(key);
                                        } else {
                                            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                                                setTheme('dark');
                                            } else {
                                                setTheme('light');
                                            }
                                            window
                                                .matchMedia('(prefers-color-scheme: dark)')
                                                .addEventListener('change', (e) => {
                                                    if (e.matches) {
                                                        setTheme('dark');
                                                    } else {
                                                        setTheme('light');
                                                    }
                                                });
                                        }
                                    }}
                                >
                                    {themeOptions.map((name) => (
                                        <DropdownItem
                                            key={name}
                                            startContent={<ThemeIcon name={name} />}
                                        >
                                            {t(`config.general.theme.${name}`)}
                                        </DropdownItem>
                                    ))}
                                </DropdownMenu>
                            </Dropdown>
                        )}
                    </div>
                    <div className='config-item'>
                        <h3 className='my-auto'>{t('config.general.app_font')}</h3>
                        {appFont !== null && fontList !== null && (
                            <Dropdown>
                                <DropdownTrigger>
                                    <Button
                                        variant='bordered'
                                        style={{
                                            fontFamily: appFont === 'default' ? 'sans-serif' : appFont,
                                        }}
                                    >
                                        {appFont === 'default' ? t('config.general.default_font') : appFont}
                                    </Button>
                                </DropdownTrigger>
                                <DropdownMenu
                                    aria-label='app font'
                                    className='max-h-[50vh] overflow-y-auto'
                                    onAction={(key) => {
                                        document.documentElement.style.fontFamily = `"${
                                            key === 'default' ? 'sans-serif' : key
                                        }","${appFallbackFont === 'default' ? 'sans-serif' : appFallbackFont}"`;
                                        setAppFont(key);
                                    }}
                                >
                                    <DropdownItem
                                        style={{ fontFamily: 'sans-serif' }}
                                        key='default'
                                    >
                                        {t('config.general.default_font')}
                                    </DropdownItem>
                                    {fontList.map((x) => {
                                        return (
                                            <DropdownItem
                                                style={{ fontFamily: x }}
                                                key={x}
                                            >
                                                {x}
                                            </DropdownItem>
                                        );
                                    })}
                                </DropdownMenu>
                            </Dropdown>
                        )}
                    </div>
                    <div className='config-item'>
                        <h3 className='my-auto'>{t('config.general.app_fallback_font')}</h3>
                        {appFallbackFont !== null && fontList !== null && (
                            <Dropdown>
                                <DropdownTrigger>
                                    <Button
                                        variant='bordered'
                                        style={{
                                            fontFamily: appFallbackFont === 'default' ? 'sans-serif' : appFallbackFont,
                                        }}
                                    >
                                        {appFallbackFont === 'default'
                                            ? t('config.general.default_font')
                                            : appFallbackFont}
                                    </Button>
                                </DropdownTrigger>
                                <DropdownMenu
                                    aria-label='app font'
                                    className='max-h-[50vh] overflow-y-auto'
                                    onAction={(key) => {
                                        document.documentElement.style.fontFamily = `"${
                                            appFont === 'default' ? 'sans-serif' : appFont
                                        }","${key === 'default' ? 'sans-serif' : key}"`;
                                        setAppFallbackFont(key);
                                    }}
                                >
                                    <DropdownItem
                                        style={{ fontFamily: 'sans-serif' }}
                                        key='default'
                                    >
                                        {t('config.general.default_font')}
                                    </DropdownItem>
                                    {fontList.map((x) => {
                                        return (
                                            <DropdownItem
                                                style={{ fontFamily: x }}
                                                key={x}
                                            >
                                                {x}
                                            </DropdownItem>
                                        );
                                    })}
                                </DropdownMenu>
                            </Dropdown>
                        )}
                    </div>
                    <div className='config-item'>
                        <h3 className='my-auto mx-0'>{t('config.general.font_size.title')}</h3>
                        {appFontSize !== null && (
                            <Dropdown>
                                <DropdownTrigger>
                                    <Button variant='bordered'>{t(`config.general.font_size.${appFontSize}`)}</Button>
                                </DropdownTrigger>
                                <DropdownMenu
                                    aria-label='window position'
                                    className='max-h-[50vh] overflow-y-auto'
                                    onAction={(key) => {
                                        document.documentElement.style.fontSize = `${key}px`;
                                        setAppFontSize(key);
                                    }}
                                >
                                    <DropdownItem key={10}>{t(`config.general.font_size.10`)}</DropdownItem>
                                    <DropdownItem key={12}>{t(`config.general.font_size.12`)}</DropdownItem>
                                    <DropdownItem key={14}>{t(`config.general.font_size.14`)}</DropdownItem>
                                    <DropdownItem key={16}>{t(`config.general.font_size.16`)}</DropdownItem>
                                    <DropdownItem key={18}>{t(`config.general.font_size.18`)}</DropdownItem>
                                    <DropdownItem key={20}>{t(`config.general.font_size.20`)}</DropdownItem>
                                    <DropdownItem key={24}>{t(`config.general.font_size.24`)}</DropdownItem>
                                </DropdownMenu>
                            </Dropdown>
                        )}
                    </div>
                    <div className={`config-item ${osType !== 'Windows_NT' ? 'hidden' : ''}`}>
                        <h3 className='my-auto'>{t('config.general.tray_click_event')}</h3>
                        {trayClickEvent !== null && (
                            <Dropdown>
                                <DropdownTrigger>
                                    <Button variant='bordered'>{t(`config.general.event.${trayClickEvent}`)}</Button>
                                </DropdownTrigger>
                                <DropdownMenu
                                    aria-label='tray click event'
                                    onAction={(key) => {
                                        setTrayClickEvent(key);
                                    }}
                                >
                                    <DropdownItem key='config'>{t('config.general.event.config')}</DropdownItem>
                                    <DropdownItem key='translate'>{t('config.general.event.translate')}</DropdownItem>
                                    <DropdownItem key='ocr_recognize'>
                                        {t('config.general.event.ocr_recognize')}
                                    </DropdownItem>
                                    <DropdownItem key='ocr_translate'>
                                        {t('config.general.event.ocr_translate')}
                                    </DropdownItem>
                                    <DropdownItem key='disable'>{t('config.general.event.disable')}</DropdownItem>
                                </DropdownMenu>
                            </Dropdown>
                        )}
                    </div>
                    <div className={`config-item ${osType === 'Darwin' ? 'hidden' : ''}`}>
                        <h3>{t('config.general.transparent')}</h3>
                        {transparent !== null && (
                            <Switch
                                isSelected={transparent}
                                onValueChange={(v) => {
                                    setTransparent(v);
                                }}
                            />
                        )}
                    </div>
                    <div className='config-item'>
                        <h3>{t('config.general.dev_mode')}</h3>
                        {devMode !== null && (
                            <Switch
                                isSelected={devMode}
                                onValueChange={(v) => {
                                    setDevMode(v);
                                }}
                            />
                        )}
                    </div>
                </CardBody>
            </Card>
            <Card>
                <CardBody>
                    <div className='config-item'>
                        <h3>{t('config.general.proxy.title')}</h3>
                        {proxyMode !== null && (
                            <Dropdown>
                                <DropdownTrigger>
                                    <Button variant='bordered'>{t(`config.general.proxy.mode.${proxyMode}`)}</Button>
                                </DropdownTrigger>
                                <DropdownMenu
                                    aria-label='proxy mode'
                                    onAction={async (key) => {
                                        if (key === 'manual' && (proxyHost === '' || proxyPort === '')) {
                                            toast.error(t('config.general.proxy_error'), {
                                                duration: 3000,
                                                style: toastStyle,
                                            });
                                            return;
                                        }
                                        setProxyMode(key);
                                        toast.success(t('config.general.proxy_change'), {
                                            duration: 1000,
                                            style: toastStyle,
                                        });
                                    }}
                                >
                                    <DropdownItem key='system'>{t('config.general.proxy.mode.system')}</DropdownItem>
                                    <DropdownItem key='manual'>{t('config.general.proxy.mode.manual')}</DropdownItem>
                                    <DropdownItem key='off'>{t('config.general.proxy.mode.off')}</DropdownItem>
                                </DropdownMenu>
                            </Dropdown>
                        )}
                    </div>
                    {proxyMode === 'system' && systemProxy !== null && (
                        <div className='config-item'>
                            <span className='text-[12px] text-muted whitespace-pre-line'>
                                {systemProxy.pac_url
                                    ? t('config.general.proxy.detected_pac', { url: systemProxy.pac_url })
                                    : systemProxy.http || systemProxy.https
                                      ? t('config.general.proxy.detected', {
                                            value: systemProxy.https ?? systemProxy.http,
                                        })
                                      : t('config.general.proxy.detected_none')}
                            </span>
                        </div>
                    )}
                    <div className={`config-item ${proxyMode === 'manual' ? '' : 'hidden'}`}>
                        {proxyHost !== null && (
                            <Input
                                type='url'
                                variant='bordered'
                                isRequired
                                label={t('config.general.proxy.host')}
                                startContent={<span>http://</span>}
                                value={proxyHost}
                                onValueChange={(v) => {
                                    setProxyHost(v);
                                }}
                                className='mr-2'
                            />
                        )}
                        {proxyPort !== null && (
                            <Input
                                type='number'
                                variant='bordered'
                                isRequired
                                label={t('config.general.proxy.port')}
                                value={proxyPort}
                                onValueChange={(v) => {
                                    if (parseInt(v) > 65535) {
                                        setProxyPort(65535);
                                    } else if (parseInt(v) < 0) {
                                        setProxyPort('');
                                    } else {
                                        setProxyPort(parseInt(v));
                                    }
                                }}
                                className='ml-2'
                            />
                        )}
                    </div>
                    <div className={`config-item ${proxyMode === 'manual' ? '' : 'hidden'}`}>
                        {proxyUsername !== null && (
                            <Input
                                type='text'
                                variant='bordered'
                                label={t('config.general.proxy.username')}
                                value={proxyUsername}
                                onValueChange={(v) => {
                                    setProxyUsername(v);
                                }}
                                className='mr-2'
                            />
                        )}
                        {proxyPassword !== null && (
                            <Input
                                type='password'
                                variant='bordered'
                                label={t('config.general.proxy.password')}
                                value={proxyPassword}
                                onValueChange={(v) => {
                                    setProxyPassword(v);
                                }}
                                className='ml-2'
                            />
                        )}
                    </div>
                    <div className={`config-item ${proxyMode === 'manual' ? '' : 'hidden'}`}>
                        {noProxy !== null && (
                            <Input
                                variant='bordered'
                                label={t('config.general.proxy.no_proxy')}
                                value={noProxy}
                                onValueChange={(v) => {
                                    setNoProxy(v);
                                }}
                            />
                        )}
                    </div>
                </CardBody>
            </Card>
        </>
    );
}
