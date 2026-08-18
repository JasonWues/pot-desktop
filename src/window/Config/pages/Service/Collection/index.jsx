import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';

import SelectPluginModal from '../SelectPluginModal';
import { useConfig, deleteKey, useDisclosure } from '../../../../../hooks';
import ServiceItem from './ServiceItem';
import SelectModal from './SelectModal';
import ConfigModal from './ConfigModal';

export default function Collection(props) {
    const { pluginList } = props;
    const {
        isOpen: isSelectPluginOpen,
        onOpen: onSelectPluginOpen,
        onOpenChange: onSelectPluginOpenChange,
    } = useDisclosure();
    const { isOpen: isSelectOpen, onOpen: onSelectOpen, onOpenChange: onSelectOpenChange } = useDisclosure();
    const { isOpen: isConfigOpen, onOpen: onConfigOpen, onOpenChange: onConfigOpenChange } = useDisclosure();
    const [currentConfigKey, setCurrentConfigKey] = useState('anki');
    // now it's service instance list
    const [collectionServiceInstanceList, setCollectionServiceInstanceList] = useConfig('collection_service_list', []);

    const { t } = useTranslation();

    const reorder = (list, startIndex, endIndex) => {
        const result = Array.from(list);
        const [removed] = result.splice(startIndex, 1);
        result.splice(endIndex, 0, removed);
        return result;
    };
    const onDragEnd = async (result) => {
        if (!result.destination) return;
        const items = reorder(collectionServiceInstanceList, result.source.index, result.destination.index);
        setCollectionServiceInstanceList(items);
    };

    const deleteServiceInstance = (instanceKey) => {
        setCollectionServiceInstanceList(collectionServiceInstanceList.filter((x) => x !== instanceKey));
        deleteKey(instanceKey);
    };
    const updateServiceInstanceList = (instanceKey) => {
        if (collectionServiceInstanceList.includes(instanceKey)) {
            return;
        } else {
            const newList = [...collectionServiceInstanceList, instanceKey];
            setCollectionServiceInstanceList(newList);
        }
    };

    return (
        <>
            <div className='service-head'>
                <span className='service-head__count'>
                    {t('config.service.instance_count', { count: collectionServiceInstanceList?.length ?? 0 })}
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
                            {collectionServiceInstanceList !== null &&
                                collectionServiceInstanceList.map((x, i) => {
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
                pluginType='collection'
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
