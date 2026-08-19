import { appLogDir, appConfigDir } from '@tauri-apps/api/path';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-shell';
// Not `shell`'s `open`: that one validates against a URL regex which no
// filesystem path can satisfy, so both directory buttons below were silently
// rejected. `openPath` is scoped by path instead -- see capabilities/default.json.
import { openPath } from '@tauri-apps/plugin-opener';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@heroui/react';

import { appVersion } from '../../../../utils/env';

const REPO = 'JasonWues/pot-desktop';

// The marker on a row that leaves the app. Inline rather than an icon import:
// it is the only glyph on the page, and react-icons has no 1:1 match for the
// design's arrow-out-of-box.
function ExternalIcon() {
    return (
        <svg
            className='about-row__icon'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            aria-hidden='true'
        >
            <path d='M15 3h6v6' />
            <path d='M10 14 21 3' />
            <path d='M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5' />
        </svg>
    );
}

function LinkRow({ label, value, onOpen }) {
    return (
        <button
            type='button'
            className='about-row'
            onClick={onOpen}
        >
            <span className='about-row__label'>{label}</span>
            <span className='about-row__value'>{value}</span>
            <ExternalIcon />
        </button>
    );
}

export default function About() {
    const { t } = useTranslation();
    // Resolved once so the rows can state where the folders actually are. The
    // buttons used to open them without ever saying what they would open.
    const [logDir, setLogDir] = useState('');
    const [configDir, setConfigDir] = useState('');

    useEffect(() => {
        appLogDir().then(setLogDir);
        appConfigDir().then(setConfigDir);
    }, []);

    return (
        <div className='about'>
            <div className='about-id'>
                <img
                    src='icon.png'
                    className='about-id__mark'
                    alt=''
                    draggable={false}
                />
                <div className='about-id__main'>
                    <div className='about-kicker'>{t('config.about.section.application')}</div>
                    <div className='about-id__name'>Pot</div>
                    <div className='about-id__version'>{appVersion}</div>
                </div>
                {/*
                    The one filled action on the page. It opens the updater
                    window, which is what does the actual checking -- the page
                    itself knows nothing about whether a release is newer, so it
                    does not claim to.
                */}
                <Button
                    variant='primary'
                    className='about-id__action'
                    onPress={() => {
                        invoke('updater_window');
                    }}
                >
                    {t('config.about.check_update')}
                </Button>
            </div>

            <div className='about-block about-block--ruled'>
                <div className='about-kicker'>{t('config.about.section.project')}</div>
                <div className='about-list'>
                    <LinkRow
                        label={t('config.about.website')}
                        value='pot-app.com'
                        onOpen={() => open('https://pot-app.com')}
                    />
                    <LinkRow
                        label={t('config.about.source')}
                        value={REPO}
                        onOpen={() => open(`https://github.com/${REPO}`)}
                    />
                    {/*
                        These two were behind a popover on the Feedback button,
                        which meant neither destination was visible until after
                        a click. As rows they cost the same space and say where
                        they go.
                    */}
                    <LinkRow
                        label={t('config.about.feedback')}
                        value={t('config.about.issue')}
                        onOpen={() => open(`https://github.com/${REPO}/issues`)}
                    />
                    <LinkRow
                        label={t('config.about.email')}
                        value='support@pot-app.com'
                        onOpen={() => open('mailto:support@pot-app.com')}
                    />
                </div>
            </div>

            <div className='about-block'>
                <div className='about-kicker'>{t('config.about.section.machine')}</div>
                <div className='about-list'>
                    <div className='about-row about-row--action'>
                        <span className='about-row__label'>{t('config.about.logs')}</span>
                        {/*
                            `bdi` so a right-to-left UI language does not reorder
                            the path itself; the value is clipped from the left,
                            which keeps the leaf folder readable.
                        */}
                        <bdi
                            className='about-row__value about-row__value--path'
                            title={logDir}
                        >
                            {logDir}
                        </bdi>
                        <Button
                            variant='tertiary'
                            size='sm'
                            onPress={() => openPath(logDir)}
                        >
                            {t('config.about.open')}
                        </Button>
                    </div>
                    <div className='about-row about-row--action'>
                        <span className='about-row__label'>{t('config.about.configuration')}</span>
                        <bdi
                            className='about-row__value about-row__value--path'
                            title={configDir}
                        >
                            {configDir}
                        </bdi>
                        <Button
                            variant='tertiary'
                            size='sm'
                            onPress={() => openPath(configDir)}
                        >
                            {t('config.about.open')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
