import NoConfigForm from '../../../components/ServiceConfigForm/NoConfigForm';
import React from 'react';

export function Config(props) {
    const { updateServiceList, onClose } = props;

    return (
        <NoConfigForm
            name='yandex'
            updateServiceList={updateServiceList}
            onClose={onClose}
        />
    );
}
