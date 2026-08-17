import { Card, CardContent, CardFooter, Button, Tooltip } from '@heroui/react';
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
        <Card
            shadow='none'
            className='bg-surface h-full ml-[12px] mr-[6px]'
            radius='10'
        >
            <CardContent className='bg-surface h-full p-0 relative'>
                {base64 !== '' && (
                    <>
                        <img
                            ref={imgRef}
                            draggable={false}
                            className='object-contain h-full w-full'
                            src={'data:image/png;base64,' + base64}
                        />
                        <InPlaceOverlay
                            ref={overlayRef}
                            imgRef={imgRef}
                            base64={base64}
                            language={language}
                            pluginList={pluginList}
                            onStatus={setInPlace}
                        />
                    </>
                )}
            </CardContent>
            <CardFooter className='bg-surface flex justify-start px-[12px] gap-[4px]'>
                <Tooltip>
                    <Button
                        isIconOnly
                        size='sm'
                        variant='light'
                        onPress={async () => {
                            await invoke('copy_img');
                        }}
                    >
                        <MdContentCopy className='text-[16px]' />
                    </Button>
                    <Tooltip.Content>{t('recognize.copy_img')}</Tooltip.Content>
                </Tooltip>
                <Button
                    size='sm'
                    variant='light'
                    isLoading={inPlace.state === 'ocr' || inPlace.state === 'translating'}
                    isDisabled={base64 === ''}
                    onPress={toggleInPlace}
                >
                    <HiTranslate className='text-[16px]' />
                    {inPlaceLabel}
                </Button>
                {inPlace.state === 'error' && (
                    <span className='text-danger text-[12px] truncate'>{inPlace.message}</span>
                )}
            </CardFooter>
        </Card>
    );
}
