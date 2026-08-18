import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';

import { useToastStyle } from '../../../../../hooks';
import SelectPluginModal from '../SelectPluginModal';
import { useConfig, deleteKey, useDisclosure } from '../../../../../hooks';
import ServiceItem from './ServiceItem';
import SelectModal from './SelectModal';
import ConfigModal from './ConfigModal';

export default function Recognize(props) {
    const { pluginList } = props;
    const {
        isOpen: isSelectPluginOpen,
        onOpen: onSelectPluginOpen,
        onOpenChange: onSelectPluginOpenChange,
    } = useDisclosure();
    const { isOpen: isSelectOpen, onOpen: onSelectOpen, onOpenChange: onSelectOpenChange } = useDisclosure();
    const { isOpen: isConfigOpen, onOpen: onConfigOpen, onOpenChange: onConfigOpenChange } = useDisclosure();
    const [currentConfigKey, setCurrentConfigKey] = useState('system');
    // now it's service instance list
    const [recognizeServiceInstanceList, setRecognizeServiceInstanceList] = useConfig('recognize_service_list', [
        'system',
        'tesseract',
    ]);

    const { t } = useTranslation();
    const toastStyle = useToastStyle();

    const reorder = (list, startIndex, endIndex) => {
        const result = Array.from(list);
        const [removed] = result.splice(startIndex, 1);
        result.splice(endIndex, 0, removed);
        return result;
    };
    const onDragEnd = async (result) => {
        if (!result.destination) return;
        const items = reorder(recognizeServiceInstanceList, result.source.index, result.destination.index);
        setRecognizeServiceInstanceList(items);
    };

    const deleteServiceInstance = (instanceKey) => {
        if (recognizeServiceInstanceList.length === 1) {
            toast.error(t('config.service.least'), { style: toastStyle });
            return;
        } else {
            setRecognizeServiceInstanceList(recognizeServiceInstanceList.filter((x) => x !== instanceKey));
            deleteKey(instanceKey);
        }
    };
    const updateServiceInstanceList = (instanceKey) => {
        if (recognizeServiceInstanceList.includes(instanceKey)) {
            return;
        } else {
            const newList = [...recognizeServiceInstanceList, instanceKey];
            setRecognizeServiceInstanceList(newList);
        }
    };

    return (
        <>
            <Toaster />
            {/*
                The count states what the numbers down the list mean: this is an
                ordered list and the order is the priority. The two add buttons
                shrink into this header -- as full-width slabs under the list
                they were the loudest thing on a page about the services that
                are already configured.
            */}
            <div className='service-head'>
                <span className='service-head__count'>
                    {t('config.service.instance_count', { count: recognizeServiceInstanceList?.length ?? 0 })}
                </span>
                <div className='service-head__actions'>
                    <button
                        type='button'
                        className='flat-outline'
                        onClick={onSelectOpen}
                    >
                        {t('config.service.add_builtin_service')}
                    </button>
                    <button
                        type='button'
                        className='flat-outline'
                        onClick={onSelectPluginOpen}
                    >
                        {t('config.service.add_external_service')}
                    </button>
                </div>
            </div>
            <DragDropContext onDragEnd={onDragEnd}>
                <Droppable
                    droppableId='droppable'
                    direction='vertical'
                >
                    {(provided) => (
                        <div
                            className='service-list'
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                        >
                            {recognizeServiceInstanceList !== null &&
                                recognizeServiceInstanceList.map((x, i) => {
                                    return (
                                        <Draggable
                                            key={x}
                                            draggableId={x}
                                            index={i}
                                        >
                                            {(provided, snapshot) => {
                                                return (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                    >
                                                        <ServiceItem
                                                            {...provided.dragHandleProps}
                                                            serviceInstanceKey={x}
                                                            key={x}
                                                            index={i}
                                                            isDragging={snapshot.isDragging}
                                                            pluginList={pluginList}
                                                            deleteServiceInstance={deleteServiceInstance}
                                                            setCurrentConfigKey={setCurrentConfigKey}
                                                            onConfigOpen={onConfigOpen}
                                                        />
                                                    </div>
                                                );
                                            }}
                                        </Draggable>
                                    );
                                })}
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
            </DragDropContext>
            <SelectPluginModal
                isOpen={isSelectPluginOpen}
                onOpenChange={onSelectPluginOpenChange}
                setCurrentConfigKey={setCurrentConfigKey}
                onConfigOpen={onConfigOpen}
                pluginType='recognize'
                pluginList={pluginList}
                deleteService={deleteServiceInstance}
            />
            <SelectModal
                isOpen={isSelectOpen}
                onOpenChange={onSelectOpenChange}
                setCurrentConfigKey={setCurrentConfigKey}
                onConfigOpen={onConfigOpen}
            />
            <ConfigModal
                serviceInstanceKey={currentConfigKey}
                isOpen={isConfigOpen}
                pluginList={pluginList}
                onOpenChange={onConfigOpenChange}
                updateServiceInstanceList={updateServiceInstanceList}
            />
        </>
    );
}
