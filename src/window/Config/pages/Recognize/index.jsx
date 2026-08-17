import { CardContent, Dropdown, Switch, Button, Card, Label } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import React from 'react';

import { languageList } from '../../../../utils/language';
import { useConfig } from '../../../../hooks';

export default function Recognize() {
    const [recognizeLanguage, setRecognizeLanguage] = useConfig('recognize_language', 'auto');
    const [deleteNewline, setDeleteNewline] = useConfig('recognize_delete_newline', false);
    const [autoCopy, setAutoCopy] = useConfig('recognize_auto_copy', false);
    const [hideWindow, setHideWindow] = useConfig('recognize_hide_window', false);
    const [closeOnBlur, setCloseOnBlur] = useConfig('recognize_close_on_blur', false);
    const { t } = useTranslation();
    return (
        <Card className='mb-[10px]'>
            <CardContent>
                <div className='config-item'>
                    <h3 className='my-auto mx-0'>{t('config.recognize.language')}</h3>
                    {recognizeLanguage !== null && (
                        <Dropdown>
                            <Button variant='secondary'>{t(`languages.${recognizeLanguage}`)}</Button>
                            <Dropdown.Popover>
                                <Dropdown.Menu
                                    aria-label='recognize language'
                                    className='max-h-[50vh] overflow-y-auto'
                                    onAction={(key) => {
                                        setRecognizeLanguage(key);
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
                    <h3 className='my-auto mx-0'>{t('config.recognize.delete_newline')}</h3>
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
                </div>
                <div className='config-item'>
                    <h3 className='my-auto mx-0'>{t('config.recognize.auto_copy')}</h3>
                    {autoCopy !== null && (
                        <Switch
                            className='justify-center items-center'
                            isSelected={autoCopy}
                            onChange={(v) => {
                                setAutoCopy(v);
                            }}
                        >
                            <Switch.Content>
                                <Switch.Control>
                                    <Switch.Thumb />
                                </Switch.Control>
                            </Switch.Content>
                        </Switch>
                    )}
                </div>
                <div className='config-item'>
                    <h3 className='my-auto mx-0'>{t('config.recognize.close_on_blur')}</h3>
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
                </div>
                <div className='config-item'>
                    <h3 className='my-auto mx-0'>{t('config.recognize.hide_window')}</h3>
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
                </div>
            </CardContent>
        </Card>
    );
}
