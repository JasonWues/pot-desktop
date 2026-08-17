import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import React from 'react';

import { createServiceInstanceKey } from '../../../../../../utils/service_instance';
import * as builtinServices from '../../../../../../services/tts';
import { osType } from '../../../../../../utils/env';

export default function SelectModal(props) {
    const { isOpen, onOpenChange, setCurrentConfigKey, onConfigOpen } = props;
    const { t } = useTranslation();

    return (
        <Modal>
            <Modal.Backdrop
                isOpen={isOpen}
                onOpenChange={onOpenChange}
            >
                <Modal.Container scroll='inside'>
                    <Modal.Dialog className='max-h-[80vh]'>
                        {({ close }) => (
                            <>
                                <ModalHeader>{t('config.service.add_service')}</ModalHeader>
                                <ModalBody>
                                    {Object.keys(builtinServices).map((x) => {
                                        return (
                                            <div key={x}>
                                                <Button
                                                    fullWidth
                                                    onPress={() => {
                                                        setCurrentConfigKey(createServiceInstanceKey(x));
                                                        onConfigOpen();
                                                    }}
                                                    startContent={
                                                        <img
                                                            src={
                                                                x === 'system_tts'
                                                                    ? `logo/${osType}.svg`
                                                                    : builtinServices[x].info.icon
                                                            }
                                                            className='h-[24px] w-[24px] my-auto'
                                                        />
                                                    }
                                                >
                                                    <div className='w-full'>
                                                        {t(`services.tts.${builtinServices[x].info.name}.title`)}
                                                    </div>
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </ModalBody>
                                <ModalFooter>
                                    <Button
                                        color='danger'
                                        variant='light'
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
