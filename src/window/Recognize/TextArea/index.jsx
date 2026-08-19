import { Skeleton } from '@heroui/react';
import { sendNotification } from '@tauri-apps/plugin-notification';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { atom, useAtom, useAtomValue } from 'jotai';
import React, { useEffect, useState } from 'react';
import { CgSpaceBetween } from 'react-icons/cg';
import { MdContentCopy } from 'react-icons/md';
import { MdSmartButton } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { nanoid } from 'nanoid';

import {
    getServiceName,
    getServiceSouceType,
    getDisplayInstanceName,
    INSTANCE_NAME_CONFIG_KEY,
    ServiceSourceType,
} from '../../../utils/service_instance';
import { currentServiceInstanceKeyAtom, languageAtom, recognizeFlagAtom } from '../ControlArea';
import { invoke_plugin } from '../../../utils/invoke_plugin';
import * as builtinServices from '../../../services/recognize';
import { useConfig } from '../../../hooks';
import { base64Atom } from '../ImageArea';
import { pluginListAtom } from '..';

export const textAtom = atom();
let recognizeId = 0;

export default function TextArea(props) {
    const { serviceInstanceConfigMap } = props;
    const [autoCopy] = useConfig('recognize_auto_copy', false);
    const [deleteNewline] = useConfig('recognize_delete_newline', false);
    const [hideWindow] = useConfig('recognize_hide_window', false);
    const recognizeFlag = useAtomValue(recognizeFlagAtom);
    const currentServiceInstanceKey = useAtomValue(currentServiceInstanceKeyAtom);
    const language = useAtomValue(languageAtom);
    const base64 = useAtomValue(base64Atom);
    const [loading, setLoading] = useState(false);
    const [text, setText] = useAtom(textAtom);
    const [error, setError] = useState('');
    const pluginList = useAtomValue(pluginListAtom);
    const { t } = useTranslation();

    // Which service produced the text on screen. The pane header states it, so
    // the reader can tell a bad result from the wrong engine without opening
    // the picker in the bar below.
    //
    // It has to be the INSTANCE's name, not the service type's: several
    // instances of one service are normal here, so "OpenAI" cannot say which of
    // them ran, and it contradicted the bar below -- which shows the name the
    // user gave the instance -- for the same running service.
    const serviceName =
        currentServiceInstanceKey &&
        getDisplayInstanceName(
            (serviceInstanceConfigMap?.[currentServiceInstanceKey] ?? {})[INSTANCE_NAME_CONFIG_KEY],
            () =>
                getServiceSouceType(currentServiceInstanceKey) === ServiceSourceType.PLUGIN
                    ? pluginList?.[getServiceName(currentServiceInstanceKey)]?.display
                    : t(`services.recognize.${getServiceName(currentServiceInstanceKey)}.title`)
        );

    useEffect(() => {
        setText('');
        setError('');
        if (
            base64 !== '' &&
            currentServiceInstanceKey &&
            autoCopy !== null &&
            deleteNewline !== null &&
            hideWindow !== null
        ) {
            setLoading(true);
            if (getServiceSouceType(currentServiceInstanceKey) === ServiceSourceType.PLUGIN) {
                if (language in pluginList[getServiceName(currentServiceInstanceKey)].language) {
                    let id = nanoid();
                    recognizeId = id;
                    const pluginConfig = serviceInstanceConfigMap[currentServiceInstanceKey] ?? {};

                    invoke_plugin('recognize', getServiceName(currentServiceInstanceKey)).then(([func, utils]) => {
                        func(base64, pluginList[getServiceName(currentServiceInstanceKey)].language[language], {
                            config: pluginConfig,
                            utils,
                        }).then(
                            (v) => {
                                if (recognizeId !== id) return;
                                v = v.trim();
                                if (deleteNewline) {
                                    v = v.replace(/\-\s+/g, '').replace(/\s+/g, ' ');
                                }
                                setText(v);
                                setLoading(false);
                                if (autoCopy) {
                                    writeText(v).then(() => {
                                        if (hideWindow) {
                                            sendNotification({
                                                title: t('common.write_clipboard'),
                                                body: v,
                                            });
                                        }
                                    });
                                }
                            },
                            (e) => {
                                if (recognizeId !== id) return;
                                setError(e.toString());
                                setLoading(false);
                            }
                        );
                    });
                }
            } else {
                const instanceConfig = serviceInstanceConfigMap[currentServiceInstanceKey] ?? {};
                if (language in builtinServices[getServiceName(currentServiceInstanceKey)].Language) {
                    let id = nanoid();
                    recognizeId = id;
                    builtinServices[getServiceName(currentServiceInstanceKey)]
                        .recognize(
                            base64,
                            builtinServices[getServiceName(currentServiceInstanceKey)].Language[language],
                            {
                                config: instanceConfig,
                            }
                        )
                        .then(
                            (v) => {
                                if (recognizeId !== id) return;
                                v = v.trim();
                                if (deleteNewline) {
                                    v = v.replace(/\-\s+/g, '').replace(/\s+/g, ' ');
                                }
                                setText(v);
                                setLoading(false);
                                if (autoCopy) {
                                    writeText(v).then(() => {
                                        if (hideWindow) {
                                            sendNotification({
                                                title: t('common.write_clipboard'),
                                                body: v,
                                            });
                                        }
                                    });
                                }
                            },
                            (e) => {
                                if (recognizeId !== id) return;
                                setError(e.toString());
                                setLoading(false);
                            }
                        );
                } else {
                    setError('Language not supported');
                    setLoading(false);
                }
            }
        }
    }, [base64, currentServiceInstanceKey, language, recognizeFlag, autoCopy, deleteNewline, hideWindow]);

    const hasText = !loading && !!text;

    return (
        <div className='recognize-pane'>
            {/*
                Char count and the service that produced the text: the two facts
                that were previously nowhere, and the reason the bottom bar no
                longer needs to name the service twice.
            */}
            <div className='recognize-pane__head'>
                <div className='recognize-pane__title'>
                    <span className='flat-label'>{t('recognize.text')}</span>
                    <span className='flat-meta'>
                        {loading
                            ? t('recognize.recognizing')
                            : [text ? t('recognize.char_count', { count: text.length }) : null, serviceName]
                                  .filter(Boolean)
                                  .join(' · ')}
                    </span>
                </div>
                <div className='recognize-pane__tools'>
                    <button
                        type='button'
                        className='flat-iconbtn'
                        title={t('recognize.copy_text')}
                        aria-label={t('recognize.copy_text')}
                        disabled={!hasText}
                        onClick={() => {
                            writeText(text);
                        }}
                    >
                        <MdContentCopy />
                    </button>
                    <button
                        type='button'
                        className='flat-iconbtn'
                        title={t('recognize.delete_newline')}
                        aria-label={t('recognize.delete_newline')}
                        disabled={!hasText}
                        onClick={() => {
                            setText(text.replace(/\-\s+/g, '').replace(/\s+/g, ' '));
                        }}
                    >
                        <MdSmartButton />
                    </button>
                    <button
                        type='button'
                        className='flat-iconbtn'
                        title={t('recognize.delete_space')}
                        aria-label={t('recognize.delete_space')}
                        disabled={!hasText}
                        onClick={() => {
                            setText(text.replaceAll(' ', ''));
                        }}
                    >
                        <CgSpaceBetween />
                    </button>
                </div>
            </div>
            <div className='recognize-pane__body'>
                {loading ? (
                    <div className='space-y-3 p-[14px] pt-[18px]'>
                        <Skeleton className='w-3/5'>
                            <div className='h-3 w-3/5 bg-default'></div>
                        </Skeleton>
                        <Skeleton className='w-4/5'>
                            <div className='h-3 w-4/5 bg-default'></div>
                        </Skeleton>
                        <Skeleton className='w-2/5'>
                            <div className='h-3 w-2/5 bg-default'></div>
                        </Skeleton>
                    </div>
                ) : (
                    <>
                        {text && (
                            <textarea
                                value={text}
                                className='recognize-text'
                                onChange={(e) => {
                                    setText(e.target.value);
                                }}
                            />
                        )}
                        {error && (
                            <textarea
                                value={error}
                                readOnly
                                className='recognize-text recognize-text--error'
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
