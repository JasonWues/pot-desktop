import { useNavigate, useLocation } from 'react-router-dom';
import { BsInfoSquareFill } from 'react-icons/bs';
import { PiTranslateFill } from 'react-icons/pi';
import { AiFillAppstore } from 'react-icons/ai';
import { useTranslation } from 'react-i18next';
import { PiTextboxFill } from 'react-icons/pi';
import { MdKeyboardAlt } from 'react-icons/md';
import { MdExtension } from 'react-icons/md';
import { AiFillCloud } from 'react-icons/ai';
import { FaHistory } from 'react-icons/fa';
import React from 'react';

/*
  The eight entries, in the order they are drawn. They were eight copies of the
  same twelve-line block before; the only thing that ever varied between them is
  in this table.
*/
const NAV = [
    { path: '/general', icon: AiFillAppstore, label: 'config.general.label' },
    { path: '/translate', icon: PiTranslateFill, label: 'config.translate.label' },
    { path: '/recognize', icon: PiTextboxFill, label: 'config.recognize.label' },
    { path: '/hotkey', icon: MdKeyboardAlt, label: 'config.hotkey.label' },
    { path: '/service', icon: MdExtension, label: 'config.service.label' },
    { path: '/history', icon: FaHistory, label: 'config.history.label' },
    { path: '/backup', icon: AiFillCloud, label: 'config.backup.label' },
    { path: '/about', icon: BsInfoSquareFill, label: 'config.about.label' },
];

export default function SideBar() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <nav className='config-nav'>
            {NAV.map(({ path, icon: Icon, label }) => {
                const current = location.pathname.includes(path);
                return (
                    <button
                        type='button'
                        key={path}
                        className={`config-nav__item ${current ? 'config-nav__item--on' : ''}`}
                        // The rows are no longer HeroUI Buttons, so the current
                        // page is stated for a screen reader rather than implied
                        // by the variant.
                        aria-current={current ? 'page' : undefined}
                        onClick={() => {
                            navigate(path);
                        }}
                    >
                        <Icon className='config-nav__icon' />
                        <span className='config-nav__label'>{t(label)}</span>
                    </button>
                );
            })}
        </nav>
    );
}
