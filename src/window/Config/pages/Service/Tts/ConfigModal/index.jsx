import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react';
import Spacer from '../../../../../../components/Spacer';
import { useTranslation } from 'react-i18next';
import React from 'react';

import {
    ServiceSourceType,
    getServiceName,
    getServiceSouceType,
    whetherPluginService,
} from '../../../../../../utils/service_instance';
import * as builtinServices from '../../../../../../services/tts';
import { osType } from '../../../../../../utils/env';
import { PluginConfig } from '../../PluginConfig';

export default function ConfigModal(props) {
    const { serviceInstanceKey, pluginList, isOpen, onOpenChange, updateServiceInstanceList } = props;

    const serviceSourceType = getServiceSouceType(serviceInstanceKey);
    const pluginServiceFlag = whetherPluginService(serviceInstanceKey);
    const serviceName = getServiceName(serviceInstanceKey);
    const { t } = useTranslation();
    const ConfigComponent = pluginServiceFlag ? PluginConfig : builtinServices[serviceName].Config;

    return pluginServiceFlag && !(serviceName in pluginList) ? (
        <></>
    ) : (
        <Modal>
            <Modal.Backdrop
                isOpen={isOpen}
                onOpenChange={onOpenChange}
            >
                <Modal.Container scroll='inside'>
                    <Modal.Dialog className='max-h-[75vh]'>
                        {({ close }) => (
                            <>
                                <ModalHeader>
                                    {serviceSourceType === ServiceSourceType.BUILDIN && (
                                        <>
                                            <img
                                                src={
                                                    serviceName === 'system_tts'
                                                        ? `logo/${osType}.svg`
                                                        : builtinServices[serviceName].info.icon
                                                }
                                                className='h-[24px] w-[24px] my-auto'
                                                draggable={false}
                                            />
                                            <Spacer x={2} />
                                            {t(`services.tts.${serviceName}.title`)}
                                        </>
                                    )}
                                    {pluginServiceFlag && (
                                        <>
                                            <img
                                                src={pluginList[serviceName].icon}
                                                className='h-[24px] w-[24px] my-auto'
                                                draggable={false}
                                            />

                                            <Spacer x={2} />
                                            {`${pluginList[serviceName].display} [${t('common.plugin')}]`}
                                        </>
                                    )}
                                </ModalHeader>
                                <ModalBody>
                                    <ConfigComponent
                                        name={serviceName}
                                        instanceKey={serviceInstanceKey}
                                        pluginType='translate'
                                        pluginList={pluginList}
                                        updateServiceList={updateServiceInstanceList}
                                        onClose={close}
                                    />
                                </ModalBody>
                                <ModalFooter>
                                    <Button
                                        variant='danger-soft'
                                        onPress={close}
                                    >
                                        {t('common.cancel')}
                                    </Button>
                                </ModalFooter>
                            </>
                        )}
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
