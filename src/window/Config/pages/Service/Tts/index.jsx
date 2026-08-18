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

export default function Tts(props) {
    const { pluginList } = props;
    const {
        isOpen: isSelectPluginOpen,
        onOpen: onSelectPluginOpen,
        onOpenChange: onSelectPluginOpenChange,
    } = useDisclosure();
    const { isOpen: isSelectOpen, onOpen: onSelectOpen, onOpenChange: onSelectOpenChange } = useDisclosure();
    const { isOpen: isConfigOpen, onOpen: onConfigOpen, onOpenChange: onConfigOpenChange } = useDisclosure();
    const [currentConfigKey, setCurrentConfigKey] = useState('lingva_tts');
    // now it's service instance list
    const [ttsServiceInstanceList, setTtsServiceInstanceList] = useConfig('tts_service_list', ['lingva_tts']);

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
        const items = reorder(ttsServiceInstanceList, result.source.index, result.destination.index);
        setTtsServiceInstanceList(items);
    };

    const deleteServiceInstance = (instanceKey) => {
        if (ttsServiceInstanceList.length === 1) {
            toast.error(t('config.service.least'), { style: toastStyle });
            return;
        } else {
            setTtsServiceInstanceList(ttsServiceInstanceList.filter((x) => x !== instanceKey));
            deleteKey(instanceKey);
        }
    };
    const updateServiceInstanceList = (instanceKey) => {
        if (ttsServiceInstanceList.includes(instanceKey)) {
            return;
        } else {
            const newList = [...ttsServiceInstanceList, instanceKey];
            setTtsServiceInstanceList(newList);
        }
    };

    return (
        <>
            <Toaster />
            <div className='service-head'>
                <span className='service-head__count'>
                    {t('config.service.instance_count', { count: ttsServiceInstanceList?.length ?? 0 })}
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
                            {ttsServiceInstanceList !== null &&
                                ttsServiceInstanceList.map((x, i) => {
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
                                                            index={i}
                                                            isDragging={snapshot.isDragging}
                                                            serviceInstanceKey={x}
                                                            key={x}
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
                pluginType='tts'
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
