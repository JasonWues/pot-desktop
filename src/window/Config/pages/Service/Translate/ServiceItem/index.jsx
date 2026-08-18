import { RxDragHandleHorizontal } from 'react-icons/rx';
import { useTranslation } from 'react-i18next';

import React from 'react';

import * as builtinServices from '../../../../../../services/translate';
import { useConfig } from '../../../../../../hooks';
import {
    INSTANCE_NAME_CONFIG_KEY,
    ServiceSourceType,
    getServiceName,
    getServiceSouceType,
} from '../../../../../../utils/service_instance';

export default function ServiceItem(props) {
    const {
        serviceInstanceKey,
        pluginList,
        deleteServiceInstance,
        setCurrentConfigKey,
        onConfigOpen,
        index,
        isDragging,
        ...drag
    } = props;
    const { t } = useTranslation();
    const [serviceInstanceConfig, setServiceInstanceConfig] = useConfig(serviceInstanceKey, {});

    const serviceSourceType = getServiceSouceType(serviceInstanceKey);
    const serviceName = getServiceName(serviceInstanceKey);
    const isPlugin = serviceSourceType === ServiceSourceType.PLUGIN;
    const enabled = serviceInstanceConfig?.['enable'] ?? true;

    return isPlugin && !(serviceName in pluginList) ? (
        <></>
    ) : (
        serviceInstanceConfig !== null && (
            <div
                className={`service-row ${index === 0 ? 'service-row--first' : ''} ${
                    isDragging ? 'service-row--marked' : ''
                }`}
            >
                <span className='service-row__rank'>{String(index + 1).padStart(2, '0')}</span>
                <img
                    className='service-row__logo'
                    src={isPlugin ? pluginList[serviceName].icon : builtinServices[serviceName].info.icon}
                    draggable={false}
                />
                <div className='service-row__body'>
                    <div className='service-row__name'>
                        {serviceInstanceConfig[INSTANCE_NAME_CONFIG_KEY] ||
                            (isPlugin ? pluginList[serviceName].display : t(`services.translate.${serviceName}.title`))}
                    </div>
                    {/*
                        Only this tab can switch a service off, so only this one
                        has a disabled state to report -- and a row that says
                        "default" while switched off would be a lie, hence the
                        first-in-order note yielding to it.
                    */}
                    <div className='service-row__note'>
                        {[
                            !enabled ? t('config.service.disabled') : index === 0 ? t('config.service.default') : null,
                            isPlugin ? t('common.plugin') : null,
                        ]
                            .filter(Boolean)
                            .join(' · ')}
                    </div>
                </div>
                <div className='service-row__tools'>
                    <span
                        {...drag}
                        className='service-row__grip'
                        aria-label={t('config.service.reorder')}
                    >
                        <RxDragHandleHorizontal />
                    </span>
                    {/*
                        A word rather than a switch. HeroUI's switch paints its
                        off-state track with `--default`, which on this row's
                        transparent ground rendered as nothing at all -- a
                        disabled service had no visible control to re-enable it.
                        A labelled action cannot disappear, and it matches the
                        two beside it.

                        The label is the verb, not the state: the state is
                        already in the note above.
                    */}
                    <button
                        type='button'
                        className='flat-action'
                        onClick={() => {
                            setServiceInstanceConfig({ ...serviceInstanceConfig, enable: !enabled });
                        }}
                    >
                        {enabled ? t('config.service.disable') : t('config.service.enable')}
                    </button>
                    <button
                        type='button'
                        className='flat-action'
                        onClick={() => {
                            setCurrentConfigKey(serviceInstanceKey);
                            onConfigOpen();
                        }}
                    >
                        {t('config.service.edit')}
                    </button>
                    <button
                        type='button'
                        className='flat-action flat-action--danger'
                        onClick={() => {
                            deleteServiceInstance(serviceInstanceKey);
                        }}
                    >
                        {t('config.service.remove')}
                    </button>
                </div>
            </div>
        )
    );
}
