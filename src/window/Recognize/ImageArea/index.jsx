import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import React, { useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { MdContentCopy } from 'react-icons/md';
import { HiTranslate } from 'react-icons/hi';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { atom, useAtom, useAtomValue } from 'jotai';

import { useConfig } from '../../../hooks';
import InPlaceOverlay from './InPlaceOverlay';
import { languageAtom } from '../ControlArea';
import { pluginListAtom } from '..';

const appWindow = getCurrentWebviewWindow();

export const base64Atom = atom('');
let unlisten = null;

export default function ImageArea() {
    const [hideWindow] = useConfig('recognize_hide_window', false);
    const [base64, setBase64] = useAtom(base64Atom);
    const imgRef = useRef();
    const overlayRef = useRef();
    const language = useAtomValue(languageAtom);
    const pluginList = useAtomValue(pluginListAtom);
    const [inPlace, setInPlace] = useState({ state: 'idle' });
    // Read off the decoded image rather than tracked separately: the pane header
    // states the capture's real pixel size, which is the one fact about it the
    // window can offer without asking anyone.
    const [size, setSize] = useState(null);
    const { t } = useTranslation();

    const toggleInPlace = async () => {
        if (inPlace.state === 'done') {
            overlayRef.current?.clear();
            setInPlace({ state: 'idle' });
            return;
        }
        try {
            await overlayRef.current?.run();
        } catch (e) {
            setInPlace({ state: 'error', message: e.toString() });
        }
    };

    const inPlaceLabel = {
        idle: t('recognize.in_place_translate'),
        ocr: t('recognize.in_place_recognizing'),
        translating: t('recognize.in_place_translating', { done: inPlace.done, total: inPlace.total }),
        done: t('recognize.in_place_restore'),
        error: t('recognize.in_place_translate'),
    }[inPlace.state];
    const load_img = () => {
        invoke('get_base64').then((v) => {
            setBase64(v);
            if (hideWindow) {
                appWindow.hide();
            } else {
                appWindow.show();
                appWindow.setFocus(true);
            }
        });
    };

    useEffect(() => {
        if (hideWindow !== null) {
            load_img();
            if (unlisten) {
                unlisten.then((f) => {
                    f();
                });
            }
            unlisten = listen('new_image', (_) => {
                load_img();
            });
        }
    }, [hideWindow]);

    return (
        <div className='recognize-pane recognize-pane--left'>
            {/*
                The pane says what it holds and how big it is, and carries the
                two tools that act on it -- copying the image, and translating
                in place. Both used to sit in a footer under a card; here the
                header is the only chrome and the image gets the rest.
            */}
            <div className='recognize-pane__head'>
                <div className='recognize-pane__title'>
                    <span className='flat-label'>{t('recognize.image')}</span>
                    {size && (
                        <span className='flat-meta'>
                            {size.width} × {size.height}
                        </span>
                    )}
                </div>
                <div className='recognize-pane__tools'>
                    <button
                        type='button'
                        className='flat-iconbtn'
                        title={t('recognize.copy_img')}
                        aria-label={t('recognize.copy_img')}
                        disabled={base64 === ''}
                        onClick={async () => {
                            await invoke('copy_img');
                        }}
                    >
                        <MdContentCopy />
                    </button>
                    <button
                        type='button'
                        className='flat-action'
                        title={inPlaceLabel}
                        disabled={base64 === '' || inPlace.state === 'ocr' || inPlace.state === 'translating'}
                        onClick={toggleInPlace}
                    >
                        <HiTranslate />
                        {inPlaceLabel}
                    </button>
                </div>
            </div>
            <div className='recognize-pane__body'>
                {base64 !== '' && (
                    <div className='recognize-image'>
                        <img
                            ref={imgRef}
                            draggable={false}
                            src={'data:image/png;base64,' + base64}
                            onLoad={(e) =>
                                setSize({
                                    width: e.currentTarget.naturalWidth,
                                    height: e.currentTarget.naturalHeight,
                                })
                            }
                        />
                        <InPlaceOverlay
                            ref={overlayRef}
                            imgRef={imgRef}
                            base64={base64}
                            language={language}
                            pluginList={pluginList}
                            onStatus={setInPlace}
                        />
                    </div>
                )}
            </div>
            {inPlace.state === 'error' && (
                <div className='recognize-pane__head recognize-bar__note--error'>
                    <span className='flat-meta recognize-bar__note--error'>{inPlace.message}</span>
                </div>
            )}
        </div>
    );
}
