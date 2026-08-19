import { Separator, Button, Popover, PopoverTrigger, PopoverContent } from '@heroui/react';
import { appLogDir, appConfigDir } from '@tauri-apps/api/path';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-shell';
// Not `shell`'s `open`: that one validates against a URL regex which no
// filesystem path can satisfy, so both directory buttons below were silently
// rejected. `openPath` is scoped by path instead -- see capabilities/default.json.
import { openPath } from '@tauri-apps/plugin-opener';
import { invoke } from '@tauri-apps/api/core';
import React from 'react';

import { appVersion } from '../../../../utils/env';

export default function About() {
    const { t } = useTranslation();

    return (
        <div className='h-full w-full py-[80px] px-[100px]'>
            <img
                src='icon.png'
                className='mx-auto h-[100px] mb-[5px]'
                draggable={false}
            />
            {/*
                Same `px-[40px]` as the row of buttons below it: both rows are
                `justify-between`, so a different inset made the two spread to
                visibly different widths under one shared separator.
            */}
            <div className='content-center px-[40px]'>
                <h1 className='font-bold text-2xl text-center'>Pot</h1>
                <p className='text-center text-sm text-gray-500 mb-[5px]'>{appVersion}</p>
                <Separator />
                <div className='flex justify-between'>
                    <Button
                        variant='tertiary'
                        className='my-[5px]'
                        size='sm'
                        onPress={() => {
                            open('https://pot-app.com');
                        }}
                    >
                        {t('config.about.website')}
                    </Button>
                    <Button
                        variant='tertiary'
                        className='my-[5px]'
                        size='sm'
                        onPress={() => {
                            open('https://github.com/JasonWues/pot-desktop');
                        }}
                    >
                        {t('config.about.github')}
                    </Button>
                    <Popover
                        placement='top'
                        offset={10}
                    >
                        <PopoverTrigger>
                            <Button
                                variant='tertiary'
                                className='my-[5px]'
                                size='sm'
                            >
                                {t('config.about.feedback')}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent>
                            <div className='flex justify-between'>
                                <Button
                                    variant='tertiary'
                                    className='my-[5px]'
                                    size='sm'
                                    onPress={() => {
                                        open('https://github.com/JasonWues/pot-desktop/issues');
                                    }}
                                >
                                    {t('config.about.issue')}
                                </Button>
                                <Button
                                    variant='tertiary'
                                    className='my-[5px]'
                                    size='sm'
                                    onPress={() => {
                                        open('mailto:support@pot-app.com');
                                    }}
                                >
                                    {t('config.about.email')}
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
                <Separator />
            </div>
            <div className='content-center px-[40px]'>
                <div className='flex justify-between'>
                    <Button
                        variant='tertiary'
                        className='my-[5px]'
                        size='sm'
                        onPress={() => {
                            invoke('updater_window');
                        }}
                    >
                        {t('config.about.check_update')}
                    </Button>
                    <Button
                        variant='tertiary'
                        className='my-[5px]'
                        size='sm'
                        onPress={async () => {
                            const dir = await appLogDir();
                            openPath(dir);
                        }}
                    >
                        {t('config.about.view_log')}
                    </Button>
                    <Button
                        variant='tertiary'
                        className='my-[5px]'
                        size='sm'
                        onPress={async () => {
                            const dir = await appConfigDir();
                            openPath(dir);
                        }}
                    >
                        {t('config.about.view_config')}
                    </Button>
                </div>

                <Separator />
            </div>
        </div>
    );
}
