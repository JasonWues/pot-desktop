import { useLocation, useRoutes } from 'react-router-dom';
import React, { useEffect, useRef, useState } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { Card, Separator } from '@heroui/react';
import { useTranslation } from 'react-i18next';

import WindowControl from '../../components/WindowControl';
import SideBar from './components/SideBar';
import { osType } from '../../utils/env';
import { useConfig } from '../../hooks';
import routes from './routes';
import './style.css';

const appWindow = getCurrentWebviewWindow();

export default function Config() {
    const [transparent] = useConfig('transparent', true);
    const { t } = useTranslation();
    const location = useLocation();
    const page = useRoutes(routes);
    const contentRef = useRef(null);

    useEffect(() => {
        if (appWindow.label === 'config') {
            appWindow.show();
        }
    }, []);

    // The pages swap inside one scroll container, so without this the next page
    // opens at the offset the previous one was left at -- switching away from a
    // scrolled General landed on Translate with its first row already cut off.
    useEffect(() => {
        contentRef.current?.scrollTo({ top: 0 });
    }, [location.pathname]);

    return (
        <>
            <Card
                shadow='none'
                className={`${
                    transparent ? 'bg-background/90' : 'bg-surface'
                } float-left w-[230px] h-screen rounded-none ${osType === 'Linux' ? 'rounded-l-[10px] border-1' : ''} border-r-2 border-r-border-secondary select-none cursor-default flex flex-col`}
            >
                <div className='h-[35px] p-[5px] flex-none'>
                    <div
                        className='w-full h-full'
                        data-tauri-drag-region='true'
                    />
                </div>
                {/* Mark and wordmark on one line. It stays a drag region: it is
                    the only part of the sidebar above the nav, so dropping that
                    would leave the window draggable only by the title strip. */}
                <div
                    className='config-brand'
                    data-tauri-drag-region='true'
                >
                    <img
                        alt=''
                        src='icon.svg'
                        className='config-brand__mark'
                        draggable={false}
                    />
                    <span className='config-brand__name'>gloss</span>
                </div>
                <SideBar />
            </Card>
            <div
                className={`bg-background ml-[230px] h-screen select-none cursor-default ${osType === 'Linux' ? 'rounded-r-[10px] border-1 border-l-0 border-border' : ''}`}
            >
                <div
                    data-tauri-drag-region='true'
                    className='top-[5px] left-[235px] right-[5px] h-[30px] fixed'
                />
                <div className='h-[35px] flex justify-between'>
                    <div className='flex'>
                        <h2 className='m-auto ml-[10px]'>{t(`config.${location.pathname.slice(1)}.title`)}</h2>
                    </div>

                    <div className='flex'>{osType !== 'Darwin' && <WindowControl />}</div>
                </div>
                <Separator />
                <div
                    ref={contentRef}
                    className={`p-[10px] overflow-y-auto ${
                        osType === 'Linux' ? 'h-[calc(100vh-38px)]' : 'h-[calc(100vh-36px)]'
                    }`}
                >
                    {page}
                </div>
            </div>
        </>
    );
}
