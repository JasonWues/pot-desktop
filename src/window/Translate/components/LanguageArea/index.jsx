import { Card, Button, CardFooter, Dropdown, Label } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { BiTransferAlt } from 'react-icons/bi';
import React, { useEffect } from 'react';
import { atom, useAtom, useAtomValue } from 'jotai';

import { languageList } from '../../../../utils/language';
import { AI_PRESETS, DEFAULT_PRESET } from '../../../../utils/ai_presets';
import { LuWand } from 'react-icons/lu';
import { detectLanguageAtom } from '../SourceArea';
import { useConfig } from '../../../../hooks';

export const sourceLanguageAtom = atom();
export const targetLanguageAtom = atom();
// Which prompt preset the LLM-backed services should run. Not persisted: it is a
// per-session mode, and silently reopening the window in 'summarize' would be a
// surprise.
export const aiPresetAtom = atom(DEFAULT_PRESET);

export default function LanguageArea() {
    const [rememberLanguage] = useConfig('translate_remember_language', false);
    const [translateSourceLanguage, setTranslateSourceLanguage] = useConfig('translate_source_language', 'auto');
    const [translateTargetLanguage, setTranslateTargetLanguage] = useConfig('translate_target_language', 'zh_cn');
    const [translateSecondLanguage] = useConfig('translate_second_language', 'en');

    const [sourceLanguage, setSourceLanguage] = useAtom(sourceLanguageAtom);
    const [targetLanguage, setTargetLanguage] = useAtom(targetLanguageAtom);
    const detectLanguage = useAtomValue(detectLanguageAtom);
    const [aiPreset, setAiPreset] = useAtom(aiPresetAtom);
    const { t } = useTranslation();

    useEffect(() => {
        if (translateSourceLanguage) {
            setSourceLanguage(translateSourceLanguage);
        }
        if (translateTargetLanguage) {
            setTargetLanguage(translateTargetLanguage);
        }
    }, [translateSourceLanguage, translateTargetLanguage]);

    useEffect(() => {
        if (rememberLanguage !== null && rememberLanguage) {
            setTranslateSourceLanguage(sourceLanguage);
            setTranslateTargetLanguage(targetLanguage);
        }
    }, [sourceLanguage, targetLanguage, rememberLanguage]);

    return (
        <Card
            shadow='none'
            className='bg-surface-secondary h-[35px] rounded-[10px]'
        >
            <CardFooter className='bg-surface-secondary flex justify-between p-0 rounded-[10px]'>
                <div className='flex'>
                    {/* The preset only reaches the LLM-backed services; the rest
                        ignore it, so it sits with the languages rather than in
                        any one service's header. */}
                    <Dropdown>
                        <Button
                            isIconOnly={aiPreset === DEFAULT_PRESET}
                            radius='sm'
                            variant='light'
                            className={aiPreset === DEFAULT_PRESET ? '' : 'text-accent'}
                        >
                            {aiPreset === DEFAULT_PRESET ? null : <LuWand className='text-[16px]' />}
                            {aiPreset === DEFAULT_PRESET ? (
                                <LuWand className='text-[16px] text-muted' />
                            ) : (
                                t(`translate.ai_preset.${aiPreset}`)
                            )}
                        </Button>
                        <Dropdown.Popover>
                            <Dropdown.Menu
                                aria-label='AI preset'
                                onAction={(key) => {
                                    setAiPreset(key);
                                }}
                            >
                                {AI_PRESETS.map((preset) => (
                                    <Dropdown.Item
                                        key={preset.id}
                                        id={preset.id}
                                    >
                                        {t(`translate.ai_preset.${preset.id}`)}
                                    </Dropdown.Item>
                                ))}
                            </Dropdown.Menu>
                        </Dropdown.Popover>
                    </Dropdown>
                    <Dropdown>
                        <Button
                            radius='sm'
                            variant='light'
                        >
                            {t(`languages.${sourceLanguage}`)}
                        </Button>
                        <Dropdown.Popover>
                            <Dropdown.Menu
                                aria-label='Source Language'
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
                                {languageList.map((x) => {
                                    return (
                                        <Dropdown.Item
                                            key={x}
                                            id={x}
                                        >
                                            {t(`languages.${x}`)}
                                        </Dropdown.Item>
                                    );
                                })}
                            </Dropdown.Menu>
                        </Dropdown.Popover>
                    </Dropdown>
                </div>
                <div className='flex'>
                    <Button
                        isIconOnly
                        size='sm'
                        variant='light'
                        className='text-[20px]'
                        onPress={async () => {
                            if (sourceLanguage !== 'auto') {
                                const oldSourceLanguage = sourceLanguage;
                                setSourceLanguage(targetLanguage);
                                setTargetLanguage(oldSourceLanguage);
                            } else {
                                if (detectLanguage !== '') {
                                    if (targetLanguage === translateTargetLanguage) {
                                        setTargetLanguage(detectLanguage);
                                    } else {
                                        setTargetLanguage(translateTargetLanguage);
                                    }
                                } else {
                                    if (targetLanguage === translateSecondLanguage) {
                                        setTargetLanguage(translateTargetLanguage);
                                    } else {
                                        setTargetLanguage(translateSecondLanguage);
                                    }
                                }
                            }
                        }}
                    >
                        <BiTransferAlt />
                    </Button>
                </div>
                <div className='flex'>
                    <Dropdown>
                        <Button
                            radius='sm'
                            variant='light'
                        >
                            {t(`languages.${targetLanguage}`)}
                        </Button>
                        <Dropdown.Popover>
                            <Dropdown.Menu
                                aria-label='Target Language'
                                className='max-h-[50vh] overflow-y-auto'
                                onAction={(key) => {
                                    setTargetLanguage(key);
                                }}
                            >
                                {languageList.map((x) => {
                                    return (
                                        <Dropdown.Item
                                            key={x}
                                            id={x}
                                        >
                                            {t(`languages.${x}`)}
                                        </Dropdown.Item>
                                    );
                                })}
                            </Dropdown.Menu>
                        </Dropdown.Popover>
                    </Dropdown>
                </div>
            </CardFooter>
        </Card>
    );
}
