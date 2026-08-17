import { unregister, isRegistered } from '@tauri-apps/plugin-global-shortcut';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { CardContent, Button, Input, Card, InputGroup } from '@heroui/react';
import React from 'react';

import { useConfig } from '../../../../hooks/useConfig';
import { useToastStyle } from '../../../../hooks';
import { osType } from '../../../../utils/env';
import { invoke } from '@tauri-apps/api/core';

const keyMap = {
    Backquote: '`',
    Backslash: '\\',
    BracketLeft: '[',
    BracketRight: ']',
    Comma: ',',
    Equal: '=',
    Minus: '-',
    Plus: 'PLUS',
    Period: '.',
    Quote: "'",
    Semicolon: ';',
    Slash: '/',
    Backspace: 'Backspace',
    CapsLock: 'Capslock',
    ContextMenu: 'Contextmenu',
    Space: 'Space',
    Tab: 'Tab',
    Convert: 'Convert',
    Delete: 'Delete',
    End: 'End',
    Help: 'Help',
    Home: 'Home',
    PageDown: 'Pagedown',
    PageUp: 'Pageup',
    Escape: 'Esc',
    PrintScreen: 'Printscreen',
    ScrollLock: 'Scrolllock',
    Pause: 'Pause',
    Insert: 'Insert',
    Suspend: 'Suspend',
};

export default function Hotkey() {
    const [selectionTranslate, setSelectionTranslate] = useConfig('hotkey_selection_translate', '');
    const [inputTranslate, setInputTranslate] = useConfig('hotkey_input_translate', '');
    const [ocrRecognize, setOcrRecognize] = useConfig('hotkey_ocr_recognize', '');
    const [ocrTranslate, setOcrTranslate] = useConfig('hotkey_ocr_translate', '');

    const { t } = useTranslation();
    const toastStyle = useToastStyle();

    function keyDown(e, setKey) {
        e.preventDefault();
        if (e.keyCode === 8) {
            setKey('');
        } else {
            let newValue = '';
            if (e.ctrlKey) {
                newValue = 'Ctrl';
            }
            if (e.shiftKey) {
                newValue = `${newValue}${newValue.length > 0 ? '+' : ''}Shift`;
            }
            if (e.metaKey) {
                newValue = `${newValue}${newValue.length > 0 ? '+' : ''}${osType === 'Darwin' ? 'Command' : 'Super'}`;
            }
            if (e.altKey) {
                newValue = `${newValue}${newValue.length > 0 ? '+' : ''}Alt`;
            }
            let code = e.code;
            if (code.startsWith('Key')) {
                code = code.substring(3);
            } else if (code.startsWith('Digit')) {
                code = code.substring(5);
            } else if (code.startsWith('Numpad')) {
                code = 'Num' + code.substring(6);
            } else if (code.startsWith('Arrow')) {
                code = code.substring(5);
            } else if (code.startsWith('Intl')) {
                code = code.substring(4);
            } else if (/F\d+/.test(code)) {
            } else if (keyMap[code] !== undefined) {
                code = keyMap[code];
            } else {
                code = '';
            }
            setKey(`${newValue}${newValue.length > 0 && code.length > 0 ? '+' : ''}${code}`);
        }
    }

    function registerHandler(name, key) {
        isRegistered(key).then((res) => {
            if (res) {
                toast.error(t('config.hotkey.is_register'), { style: toastStyle });
            } else {
                invoke('register_shortcut_by_frontend', {
                    name: name,
                    shortcut: key,
                }).then(
                    () => {
                        toast.success(t('config.hotkey.success'), { style: toastStyle });
                    },
                    (e) => {
                        toast.error(e, { style: toastStyle });
                    }
                );
            }
        });
    }

    return (
        <Card>
            <Toaster />
            <CardContent>
                <div className='config-item'>
                    <h3 className='my-auto'>{t('config.hotkey.selection_translate')}</h3>
                    {/* InputGroup, not Input with children: v3's Input renders a real
                        <input>, which is a void element and cannot hold the OK button.
                        `label` is not a v3 Input prop either, and the row's own <h3>
                        already names the field, so it becomes the aria-label.
                        `readOnly` because the value is driven by onKeyDown, and React
                        warns on a `value` with no `onChange`. The same shape repeats
                        for the three hotkey fields below. */}
                    {selectionTranslate !== null && (
                        <InputGroup className='max-w-[50%]'>
                            <InputGroup.Input
                                type='hotkey'
                                aria-label={t('config.hotkey.set_hotkey')}
                                value={selectionTranslate}
                                readOnly
                                onKeyDown={(e) => {
                                    keyDown(e, setSelectionTranslate);
                                }}
                                onFocus={() => {
                                    unregister(selectionTranslate);
                                    setSelectionTranslate('');
                                }}
                            />
                            <InputGroup.Suffix>
                                <Button
                                    size='sm'
                                    variant='tertiary'
                                    className={`${selectionTranslate === '' ? 'hidden' : ''}`}
                                    onPress={() => {
                                        registerHandler('hotkey_selection_translate', selectionTranslate);
                                    }}
                                >
                                    {t('common.ok')}
                                </Button>
                            </InputGroup.Suffix>
                        </InputGroup>
                    )}
                </div>
                <div className='config-item'>
                    <h3 className='my-auto'>{t('config.hotkey.input_translate')}</h3>
                    {inputTranslate !== null && (
                        <InputGroup className='max-w-[50%]'>
                            <InputGroup.Input
                                type='hotkey'
                                aria-label={t('config.hotkey.set_hotkey')}
                                value={inputTranslate}
                                readOnly
                                onKeyDown={(e) => {
                                    keyDown(e, setInputTranslate);
                                }}
                                onFocus={() => {
                                    unregister(inputTranslate);
                                    setInputTranslate('');
                                }}
                            />
                            <InputGroup.Suffix>
                                <Button
                                    size='sm'
                                    variant='tertiary'
                                    className={`${inputTranslate === '' ? 'hidden' : ''}`}
                                    onPress={() => {
                                        registerHandler('hotkey_input_translate', inputTranslate);
                                    }}
                                >
                                    {t('common.ok')}
                                </Button>
                            </InputGroup.Suffix>
                        </InputGroup>
                    )}
                </div>
                <div className='config-item'>
                    <h3 className='my-auto'>{t('config.hotkey.ocr_recognize')}</h3>
                    {ocrRecognize !== null && (
                        <InputGroup className='max-w-[50%]'>
                            <InputGroup.Input
                                type='hotkey'
                                aria-label={t('config.hotkey.set_hotkey')}
                                value={ocrRecognize}
                                readOnly
                                onKeyDown={(e) => {
                                    keyDown(e, setOcrRecognize);
                                }}
                                onFocus={() => {
                                    unregister(ocrRecognize);
                                    setOcrRecognize('');
                                }}
                            />
                            <InputGroup.Suffix>
                                <Button
                                    size='sm'
                                    variant='tertiary'
                                    className={`${ocrRecognize === '' ? 'hidden' : ''}`}
                                    onPress={() => {
                                        registerHandler('hotkey_ocr_recognize', ocrRecognize);
                                    }}
                                >
                                    {t('common.ok')}
                                </Button>
                            </InputGroup.Suffix>
                        </InputGroup>
                    )}
                </div>
                <div className='config-item'>
                    <h3 className='my-auto'>{t('config.hotkey.ocr_translate')}</h3>
                    {ocrTranslate !== null && (
                        <InputGroup className='max-w-[50%]'>
                            <InputGroup.Input
                                type='hotkey'
                                aria-label={t('config.hotkey.set_hotkey')}
                                value={ocrTranslate}
                                readOnly
                                onKeyDown={(e) => {
                                    keyDown(e, setOcrTranslate);
                                }}
                                onFocus={() => {
                                    unregister(ocrTranslate);
                                    setOcrTranslate('');
                                }}
                            />
                            <InputGroup.Suffix>
                                <Button
                                    size='sm'
                                    variant='tertiary'
                                    className={`${ocrTranslate === '' ? 'hidden' : ''}`}
                                    onPress={() => {
                                        registerHandler('hotkey_ocr_translate', ocrTranslate);
                                    }}
                                >
                                    {t('common.ok')}
                                </Button>
                            </InputGroup.Suffix>
                        </InputGroup>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
