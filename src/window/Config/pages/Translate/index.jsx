import { CardContent, Dropdown, Switch, Button, Card, Label } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import toast, { Toaster } from 'react-hot-toast';
import React, { useEffect, useState } from 'react';

import { clearCache, getCacheCount } from '../../../../utils/db';
import { languageList } from '../../../../utils/language';
import { useConfig } from '../../../../hooks/useConfig';
import { useToastStyle } from '../../../../hooks';
import { invoke } from '@tauri-apps/api/core';

const CACHE_TTL_OPTIONS = [1, 3, 7, 30, 365];

export default function Translate() {
    const [sourceLanguage, setSourceLanguage] = useConfig('translate_source_language', 'auto');
    const [targetLanguage, setTargetLanguage] = useConfig('translate_target_language', 'zh_cn');
    const [secondLanguage, setSecondLanguage] = useConfig('translate_second_language', 'en');
    const [detectEngine, setDetectEngine] = useConfig('translate_detect_engine', 'baidu');
    const [autoCopy, setAutoCopy] = useConfig('translate_auto_copy', 'disable');
    const [incrementalTranslate, setIncrementalTranslate] = useConfig('incremental_translate', false);
    const [historyDisable, setHistoryDisable] = useConfig('history_disable', false);
    const [dynamicTranslate, setDynamicTranslate] = useConfig('dynamic_translate', false);
    const [deleteNewline, setDeleteNewline] = useConfig('translate_delete_newline', false);
    const [rememberLanguage, setRememberLanguage] = useConfig('translate_remember_language', false);
    // const [translateFontSize, setTranslateFontSize] = useConfig('translate_font_size', 16);
    const [windowPosition, setWindowPosition] = useConfig('translate_window_position', 'mouse');
    const [rememberWindowSize, setRememberWindowSize] = useConfig('translate_remember_window_size', false);
    const [hideSource, setHideSource] = useConfig('hide_source', false);
    const [hideLanguage, setHideLanguage] = useConfig('hide_language', false);
    const [hideWindow, setHideWindow] = useConfig('translate_hide_window', false);
    const [closeOnBlur, setCloseOnBlur] = useConfig('translate_close_on_blur', true);
    const [alwaysOnTop, setAlwaysOnTop] = useConfig('translate_always_on_top', false);
    const [cacheEnable, setCacheEnable] = useConfig('translate_cache_enable', true);
    const [cacheTtl, setCacheTtl] = useConfig('translate_cache_ttl', 7);
    const [cacheCount, setCacheCount] = useState(0);
    const toastStyle = useToastStyle();
    const { t } = useTranslation();

    useEffect(() => {
        getCacheCount().then(setCacheCount, () => setCacheCount(0));
    }, []);

    return (
        <>
            <Toaster />
            <Card className='mb-[10px]'>
                <CardContent>
                    <div className='config-item'>
                        <h3 className='my-auto mx-0'>{t('config.translate.source_language')}</h3>
                        {sourceLanguage !== null && (
                            <Dropdown>
                                <Button variant='bordered'>{t(`languages.${sourceLanguage}`)}</Button>
                                <Dropdown.Popover>
                                    <Dropdown.Menu
                                        aria-label='source language'
                                        className='max-h-[50vh] overflow-y-auto'
                                        onAction={(key) => {
                                            setSourceLanguage(key);
                                        }}
                                    >
                                        <Dropdown.Item
                                            key='auto'
                                            id='auto'
                                        >
                                            <Label>{t('languages.auto')}</Label>
                                        </Dropdown.Item>
                                        {languageList.map((item) => {
                                            return (
                                                <Dropdown.Item
                                                    key={item}
                                                    id={item}
                                                >
                                                    {t(`languages.${item}`)}
                                                </Dropdown.Item>
                                            );
                                        })}
                                    </Dropdown.Menu>
                                </Dropdown.Popover>
                            </Dropdown>
                        )}
                    </div>
                    <div className='config-item'>
                        <h3 className='my-auto mx-0'>{t('config.translate.target_language')}</h3>
                        {targetLanguage !== null && (
                            <Dropdown>
                                <Button variant='bordered'>{t(`languages.${targetLanguage}`)}</Button>
                                <Dropdown.Popover>
                                    <Dropdown.Menu
                                        aria-label='target language'
                                        className='max-h-[50vh] overflow-y-auto'
                                        onAction={(key) => {
                                            setTargetLanguage(key);
                                        }}
                                    >
                                        {languageList.map((item) => {
                                            return (
                                                <Dropdown.Item
                                                    key={item}
                                                    id={item}
                                                >
                                                    {t(`languages.${item}`)}
                                                </Dropdown.Item>
                                            );
                                        })}
                                    </Dropdown.Menu>
                                </Dropdown.Popover>
                            </Dropdown>
                        )}
                    </div>
                    <div className='config-item'>
                        <h3 className='my-auto mx-0'>{t('config.translate.second_language')}</h3>
                        {secondLanguage !== null && (
                            <Dropdown>
                                <Button variant='bordered'>{t(`languages.${secondLanguage}`)}</Button>
                                <Dropdown.Popover>
                                    <Dropdown.Menu
                                        aria-label='second language'
                                        className='max-h-[50vh] overflow-y-auto'
                                        onAction={(key) => {
                                            setSecondLanguage(key);
                                        }}
                                    >
                                        {languageList.map((item) => {
                                            return (
                                                <Dropdown.Item
                                                    key={item}
                                                    id={item}
                                                >
                                                    {t(`languages.${item}`)}
                                                </Dropdown.Item>
                                            );
                                        })}
                                    </Dropdown.Menu>
                                </Dropdown.Popover>
                            </Dropdown>
                        )}
                    </div>
                    <div className='config-item'>
                        <h3 className='my-auto mx-0'>{t('config.translate.detect_engine')}</h3>
                        {detectEngine !== null && (
                            <Dropdown>
                                <Button variant='bordered'>{t(`config.translate.${detectEngine}`)}</Button>
                                <Dropdown.Popover>
                                    <Dropdown.Menu
                                        aria-label='detect engine'
                                        className='max-h-[50vh] overflow-y-auto'
                                        onAction={(key) => {
                                            setDetectEngine(key);
                                        }}
                                    >
                                        <Dropdown.Item
                                            key='baidu'
                                            id='baidu'
                                        >
                                            <Label>{t(`config.translate.baidu`)}</Label>
                                        </Dropdown.Item>
                                        <Dropdown.Item
                                            key='tencent'
                                            id='tencent'
                                        >
                                            <Label>{t(`config.translate.tencent`)}</Label>
                                        </Dropdown.Item>
                                        <Dropdown.Item
                                            key='niutrans'
                                            id='niutrans'
                                        >
                                            <Label>{t(`config.translate.niutrans`)}</Label>
                                        </Dropdown.Item>
                                        <Dropdown.Item
                                            key='google'
                                            id='google'
                                        >
                                            <Label>{t(`config.translate.google`)}</Label>
                                        </Dropdown.Item>
                                        <Dropdown.Item
                                            key='bing'
                                            id='bing'
                                        >
                                            <Label>{t(`config.translate.bing`)}</Label>
                                        </Dropdown.Item>
                                        <Dropdown.Item
                                            key='yandex'
                                            id='yandex'
                                        >
                                            <Label>{t(`config.translate.yandex`)}</Label>
                                        </Dropdown.Item>
                                        <Dropdown.Item
                                            key='local'
                                            id='local'
                                        >
                                            <Label>{t(`config.translate.local`)}</Label>
                                        </Dropdown.Item>
                                    </Dropdown.Menu>
                                </Dropdown.Popover>
                            </Dropdown>
                        )}
                    </div>
                </CardContent>
            </Card>
            <Card className='mb-[10px]'>
                <CardContent>
                    <div className='config-item'>
                        <h3 className='my-auto mx-0'>{t('config.translate.auto_copy')}</h3>
                        {autoCopy !== null && (
                            <Dropdown>
                                <Button variant='bordered'>{t(`config.translate.${autoCopy}`)}</Button>
                                <Dropdown.Popover>
                                    <Dropdown.Menu
                                        aria-label='auto copy'
                                        className='max-h-[50vh] overflow-y-auto'
                                        onAction={(key) => {
                                            setAutoCopy(key);
                                            invoke('update_tray', { language: '', copyMode: key });
                                        }}
                                    >
                                        <Dropdown.Item
                                            key='source'
                                            id='source'
                                        >
                                            <Label>{t('config.translate.source')}</Label>
                                        </Dropdown.Item>
                                        <Dropdown.Item
                                            key='target'
                                            id='target'
                                        >
                                            <Label>{t('config.translate.target')}</Label>
                                        </Dropdown.Item>
                                        <Dropdown.Item
                                            key='source_target'
                                            id='source_target'
                                        >
                                            {t('config.translate.source_target')}
                                        </Dropdown.Item>
                                        <Dropdown.Item
                                            key='disable'
                                            id='disable'
                                        >
                                            <Label>{t('config.translate.disable')}</Label>
                                        </Dropdown.Item>
                                    </Dropdown.Menu>
                                </Dropdown.Popover>
                            </Dropdown>
                        )}
                    </div>
                    <div className='config-item'>
                        <h3>{t('config.translate.history_disable')}</h3>
                        {historyDisable !== null && (
                            <Switch
                                isSelected={historyDisable}
                                onValueChange={(v) => {
                                    setHistoryDisable(v);
                                }}
                            />
                        )}
                    </div>
                    <div className='config-item'>
                        <h3 className='my-auto mx-0'>{t('config.translate.cache_enable')}</h3>
                        {cacheEnable !== null && (
                            <Switch
                                isSelected={cacheEnable}
                                onValueChange={(v) => {
                                    setCacheEnable(v);
                                }}
                            />
                        )}
                    </div>
                    <div className={`config-item ${!cacheEnable ? 'hidden' : ''}`}>
                        <h3 className='my-auto mx-0'>{t('config.translate.cache_ttl')}</h3>
                        {cacheTtl !== null && (
                            <Dropdown>
                                <Button variant='bordered'>
                                    {t('config.translate.cache_ttl_value', { days: cacheTtl })}
                                </Button>
                                <Dropdown.Popover>
                                    <Dropdown.Menu
                                        aria-label='cache ttl'
                                        onAction={(key) => {
                                            setCacheTtl(Number(key));
                                        }}
                                    >
                                        {CACHE_TTL_OPTIONS.map((days) => (
                                            <Dropdown.Item
                                                key={days}
                                                id={days}
                                            >
                                                {t('config.translate.cache_ttl_value', { days })}
                                            </Dropdown.Item>
                                        ))}
                                    </Dropdown.Menu>
                                </Dropdown.Popover>
                            </Dropdown>
                        )}
                    </div>
                    <div className={`config-item ${!cacheEnable ? 'hidden' : ''}`}>
                        <h3 className='my-auto mx-0'>{t('config.translate.cache_clear')}</h3>
                        <Button
                            variant='flat'
                            color='danger'
                            onPress={() => {
                                clearCache().then(
                                    () => {
                                        setCacheCount(0);
                                        toast.success(t('config.translate.cache_cleared'), { style: toastStyle });
                                    },
                                    (e) => {
                                        toast.error(e.toString(), { style: toastStyle });
                                    }
                                );
                            }}
                        >
                            {t('config.translate.cache_count', { n: cacheCount })}
                        </Button>
                    </div>
                    <div className='config-item'>
                        <h3 className='my-auto mx-0'>{t('config.translate.incremental_translate')}</h3>
                        {incrementalTranslate !== null && (
                            <Switch
                                isSelected={incrementalTranslate}
                                onValueChange={(v) => {
                                    setIncrementalTranslate(v);
                                }}
                            />
                        )}
                    </div>
                    <div className='config-item'>
                        <h3 className='my-auto mx-0'>{t('config.translate.dynamic_translate')}</h3>
                        {dynamicTranslate !== null && (
                            <Switch
                                isSelected={dynamicTranslate}
                                onValueChange={(v) => {
                                    setDynamicTranslate(v);
                                }}
                            />
                        )}
                    </div>
                    <div className='config-item'>
                        <h3 className='my-auto mx-0'>{t('config.translate.delete_newline')}</h3>
                        {deleteNewline !== null && (
                            <Switch
                                isSelected={deleteNewline}
                                onValueChange={(v) => {
                                    setDeleteNewline(v);
                                }}
                            />
                        )}
                    </div>
                    <div className='config-item'>
                        <h3 className='my-auto mx-0'>{t('config.translate.remember_language')}</h3>
                        {rememberLanguage !== null && (
                            <Switch
                                isSelected={rememberLanguage}
                                onValueChange={(v) => {
                                    setRememberLanguage(v);
                                }}
                            />
                        )}
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardContent>
                    {/* <div className='config-item'>
                        <h3 className='my-auto mx-0'>{t('config.translate.font_size.title')}</h3>
                        {translateFontSize !== null && (
                            <Dropdown>
                                    <Button variant='bordered'>
                                        {t(`config.translate.font_size.${translateFontSize}`)}
                                    </Button>
                                <Dropdown.Popover>
                                <Dropdown.Menu
                                    aria-label='window position'
                                    className='max-h-[50vh] overflow-y-auto'
                                    onAction={(key) => {
                                        setTranslateFontSize(key);
                                    }}
                                >
                                    <Dropdown.Item key={10} id={10}><Label>{t(`config.translate.font_size.10`)}</Label></Dropdown.Item>
                                    <Dropdown.Item key={12} id={12}><Label>{t(`config.translate.font_size.12`)}</Label></Dropdown.Item>
                                    <Dropdown.Item key={14} id={14}><Label>{t(`config.translate.font_size.14`)}</Label></Dropdown.Item>
                                    <Dropdown.Item key={16} id={16}><Label>{t(`config.translate.font_size.16`)}</Label></Dropdown.Item>
                                    <Dropdown.Item key={18} id={18}><Label>{t(`config.translate.font_size.18`)}</Label></Dropdown.Item>
                                    <Dropdown.Item key={20} id={20}><Label>{t(`config.translate.font_size.20`)}</Label></Dropdown.Item>
                                    <Dropdown.Item key={24} id={24}><Label>{t(`config.translate.font_size.24`)}</Label></Dropdown.Item>
                                </Dropdown.Menu>
                                </Dropdown.Popover>
                            </Dropdown>
                        )}
                    </div> */}
                    <div className='config-item'>
                        <h3 className='my-auto mx-0'>{t('config.translate.window_position')}</h3>
                        {windowPosition !== null && (
                            <Dropdown>
                                <Button variant='bordered'>{t(`config.translate.${windowPosition}`)}</Button>
                                <Dropdown.Popover>
                                    <Dropdown.Menu
                                        aria-label='window position'
                                        className='max-h-[50vh] overflow-y-auto'
                                        onAction={(key) => {
                                            setWindowPosition(key);
                                        }}
                                    >
                                        <Dropdown.Item
                                            key='mouse'
                                            id='mouse'
                                        >
                                            <Label>{t('config.translate.mouse')}</Label>
                                        </Dropdown.Item>
                                        <Dropdown.Item
                                            key='pre_state'
                                            id='pre_state'
                                        >
                                            <Label>{t('config.translate.pre_state')}</Label>
                                        </Dropdown.Item>
                                    </Dropdown.Menu>
                                </Dropdown.Popover>
                            </Dropdown>
                        )}
                    </div>
                    <div className='config-item'>
                        <h3 className='my-auto mx-0'>{t('config.translate.remember_window_size')}</h3>
                        {rememberWindowSize !== null && (
                            <Switch
                                isSelected={rememberWindowSize}
                                onValueChange={(v) => {
                                    setRememberWindowSize(v);
                                }}
                            />
                        )}
                    </div>
                    <div className='config-item'>
                        <h3 className='my-auto mx-0'>{t('config.translate.close_on_blur')}</h3>
                        {closeOnBlur !== null && (
                            <Switch
                                isSelected={closeOnBlur}
                                onValueChange={(v) => {
                                    setCloseOnBlur(v);
                                }}
                            />
                        )}
                    </div>
                    <div className='config-item'>
                        <h3 className='my-auto mx-0'>{t('config.translate.always_on_top')}</h3>
                        {alwaysOnTop !== null && (
                            <Switch
                                isSelected={alwaysOnTop}
                                onValueChange={(v) => {
                                    setAlwaysOnTop(v);
                                }}
                            />
                        )}
                    </div>
                    <div className='config-item'>
                        <h3 className='my-auto mx-0'>{t('config.translate.hide_source')}</h3>
                        {hideSource !== null && (
                            <Switch
                                isSelected={hideSource}
                                onValueChange={(v) => {
                                    setHideSource(v);
                                }}
                            />
                        )}
                    </div>
                    <div className='config-item'>
                        <h3 className='my-auto mx-0'>{t('config.translate.hide_language')}</h3>
                        {hideLanguage !== null && (
                            <Switch
                                isSelected={hideLanguage}
                                onValueChange={(v) => {
                                    setHideLanguage(v);
                                }}
                            />
                        )}
                    </div>
                    <div className='config-item'>
                        <h3 className='my-auto mx-0'>{t('config.translate.hide_window')}</h3>
                        {hideWindow !== null && (
                            <Switch
                                isSelected={hideWindow}
                                onValueChange={(v) => {
                                    setHideWindow(v);
                                }}
                            />
                        )}
                    </div>
                </CardContent>
            </Card>
        </>
    );
}
