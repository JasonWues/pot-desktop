import { Dropdown, Switch, Button, Label } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import React, { useEffect, useState } from 'react';

import { clearCache, getCacheCount } from '../../../../utils/db';
import { languageList } from '../../../../utils/language';
import { Section, Row } from '../../components/Section';
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
            <Section
                name={t('config.translate.section.languages')}
                note={t('config.translate.section.languages_note')}
            >
                <Row
                    label={t('config.translate.source_language')}
                    desc={t('config.translate.source_language_desc')}
                >
                    {sourceLanguage !== null && (
                        <Dropdown>
                            <Button variant='outline'>{t(`languages.${sourceLanguage}`)}</Button>
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
                </Row>
                <Row
                    label={t('config.translate.target_language')}
                    desc={t('config.translate.target_language_desc')}
                >
                    {targetLanguage !== null && (
                        <Dropdown>
                            <Button variant='outline'>{t(`languages.${targetLanguage}`)}</Button>
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
                </Row>
                <Row
                    label={t('config.translate.second_language')}
                    desc={t('config.translate.second_language_desc')}
                >
                    {secondLanguage !== null && (
                        <Dropdown>
                            <Button variant='outline'>{t(`languages.${secondLanguage}`)}</Button>
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
                </Row>
                <Row
                    label={t('config.translate.detect_engine')}
                    desc={t('config.translate.detect_engine_desc')}
                >
                    {detectEngine !== null && (
                        <Dropdown>
                            <Button variant='outline'>{t(`config.translate.${detectEngine}`)}</Button>
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
                </Row>
            </Section>
            <Section
                name={t('config.translate.section.behaviour')}
                note={t('config.translate.section.behaviour_note')}
            >
                <Row
                    label={t('config.translate.auto_copy')}
                    desc={t('config.translate.auto_copy_desc')}
                >
                    {autoCopy !== null && (
                        <Dropdown>
                            <Button variant='outline'>{t(`config.translate.${autoCopy}`)}</Button>
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
                </Row>
                <Row
                    label={t('config.translate.history_disable')}
                    desc={t('config.translate.history_disable_desc')}
                >
                    {historyDisable !== null && (
                        <Switch
                            className='justify-center items-center'
                            isSelected={historyDisable}
                            onChange={(v) => {
                                setHistoryDisable(v);
                            }}
                        >
                            <Switch.Content>
                                <Switch.Control>
                                    <Switch.Thumb />
                                </Switch.Control>
                            </Switch.Content>
                        </Switch>
                    )}
                </Row>
                <Row
                    label={t('config.translate.cache_enable')}
                    desc={t('config.translate.cache_enable_desc')}
                >
                    {cacheEnable !== null && (
                        <Switch
                            className='justify-center items-center'
                            isSelected={cacheEnable}
                            onChange={(v) => {
                                setCacheEnable(v);
                            }}
                        >
                            <Switch.Content>
                                <Switch.Control>
                                    <Switch.Thumb />
                                </Switch.Control>
                            </Switch.Content>
                        </Switch>
                    )}
                </Row>
                <Row
                    className={!cacheEnable ? 'hidden' : ''}
                    label={t('config.translate.cache_ttl')}
                    desc={t('config.translate.cache_ttl_desc')}
                >
                    {cacheTtl !== null && (
                        <Dropdown>
                            <Button variant='outline'>
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
                </Row>
                <Row
                    className={!cacheEnable ? 'hidden' : ''}
                    label={t('config.translate.cache_clear')}
                    desc={t('config.translate.cache_clear_desc')}
                >
                    <Button
                        variant='danger-soft'
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
                </Row>
                <Row
                    label={t('config.translate.incremental_translate')}
                    desc={t('config.translate.incremental_translate_desc')}
                >
                    {incrementalTranslate !== null && (
                        <Switch
                            className='justify-center items-center'
                            isSelected={incrementalTranslate}
                            onChange={(v) => {
                                setIncrementalTranslate(v);
                            }}
                        >
                            <Switch.Content>
                                <Switch.Control>
                                    <Switch.Thumb />
                                </Switch.Control>
                            </Switch.Content>
                        </Switch>
                    )}
                </Row>
                <Row
                    label={t('config.translate.dynamic_translate')}
                    desc={t('config.translate.dynamic_translate_desc')}
                >
                    {dynamicTranslate !== null && (
                        <Switch
                            className='justify-center items-center'
                            isSelected={dynamicTranslate}
                            onChange={(v) => {
                                setDynamicTranslate(v);
                            }}
                        >
                            <Switch.Content>
                                <Switch.Control>
                                    <Switch.Thumb />
                                </Switch.Control>
                            </Switch.Content>
                        </Switch>
                    )}
                </Row>
                <Row
                    label={t('config.translate.delete_newline')}
                    desc={t('config.translate.delete_newline_desc')}
                >
                    {deleteNewline !== null && (
                        <Switch
                            className='justify-center items-center'
                            isSelected={deleteNewline}
                            onChange={(v) => {
                                setDeleteNewline(v);
                            }}
                        >
                            <Switch.Content>
                                <Switch.Control>
                                    <Switch.Thumb />
                                </Switch.Control>
                            </Switch.Content>
                        </Switch>
                    )}
                </Row>
                <Row
                    label={t('config.translate.remember_language')}
                    desc={t('config.translate.remember_language_desc')}
                >
                    {rememberLanguage !== null && (
                        <Switch
                            className='justify-center items-center'
                            isSelected={rememberLanguage}
                            onChange={(v) => {
                                setRememberLanguage(v);
                            }}
                        >
                            <Switch.Content>
                                <Switch.Control>
                                    <Switch.Thumb />
                                </Switch.Control>
                            </Switch.Content>
                        </Switch>
                    )}
                </Row>
            </Section>
            <Section
                name={t('config.translate.section.window')}
                note={t('config.translate.section.window_note')}
            >
                {/* <div className='config-item'>
                        <h3 className='my-auto mx-0'>{t('config.translate.font_size.title')}</h3>
                        {translateFontSize !== null && (
                            <Dropdown>
                                    <Button variant='outline'>
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
                <Row
                    label={t('config.translate.window_position')}
                    desc={t('config.translate.window_position_desc')}
                >
                    {windowPosition !== null && (
                        <Dropdown>
                            <Button variant='outline'>{t(`config.translate.${windowPosition}`)}</Button>
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
                </Row>
                <Row
                    label={t('config.translate.remember_window_size')}
                    desc={t('config.translate.remember_window_size_desc')}
                >
                    {rememberWindowSize !== null && (
                        <Switch
                            className='justify-center items-center'
                            isSelected={rememberWindowSize}
                            onChange={(v) => {
                                setRememberWindowSize(v);
                            }}
                        >
                            <Switch.Content>
                                <Switch.Control>
                                    <Switch.Thumb />
                                </Switch.Control>
                            </Switch.Content>
                        </Switch>
                    )}
                </Row>
                <Row
                    label={t('config.translate.close_on_blur')}
                    desc={t('config.translate.close_on_blur_desc')}
                >
                    {closeOnBlur !== null && (
                        <Switch
                            className='justify-center items-center'
                            isSelected={closeOnBlur}
                            onChange={(v) => {
                                setCloseOnBlur(v);
                            }}
                        >
                            <Switch.Content>
                                <Switch.Control>
                                    <Switch.Thumb />
                                </Switch.Control>
                            </Switch.Content>
                        </Switch>
                    )}
                </Row>
                <Row
                    label={t('config.translate.always_on_top')}
                    desc={t('config.translate.always_on_top_desc')}
                >
                    {alwaysOnTop !== null && (
                        <Switch
                            className='justify-center items-center'
                            isSelected={alwaysOnTop}
                            onChange={(v) => {
                                setAlwaysOnTop(v);
                            }}
                        >
                            <Switch.Content>
                                <Switch.Control>
                                    <Switch.Thumb />
                                </Switch.Control>
                            </Switch.Content>
                        </Switch>
                    )}
                </Row>
                <Row
                    label={t('config.translate.hide_source')}
                    desc={t('config.translate.hide_source_desc')}
                >
                    {hideSource !== null && (
                        <Switch
                            className='justify-center items-center'
                            isSelected={hideSource}
                            onChange={(v) => {
                                setHideSource(v);
                            }}
                        >
                            <Switch.Content>
                                <Switch.Control>
                                    <Switch.Thumb />
                                </Switch.Control>
                            </Switch.Content>
                        </Switch>
                    )}
                </Row>
                <Row
                    label={t('config.translate.hide_language')}
                    desc={t('config.translate.hide_language_desc')}
                >
                    {hideLanguage !== null && (
                        <Switch
                            className='justify-center items-center'
                            isSelected={hideLanguage}
                            onChange={(v) => {
                                setHideLanguage(v);
                            }}
                        >
                            <Switch.Content>
                                <Switch.Control>
                                    <Switch.Thumb />
                                </Switch.Control>
                            </Switch.Content>
                        </Switch>
                    )}
                </Row>
                <Row
                    label={t('config.translate.hide_window')}
                    desc={t('config.translate.hide_window_desc')}
                >
                    {hideWindow !== null && (
                        <Switch
                            className='justify-center items-center'
                            isSelected={hideWindow}
                            onChange={(v) => {
                                setHideWindow(v);
                            }}
                        >
                            <Switch.Content>
                                <Switch.Control>
                                    <Switch.Thumb />
                                </Switch.Control>
                            </Switch.Content>
                        </Switch>
                    )}
                </Row>
            </Section>
        </>
    );
}
