import { Input, Label, TextField } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import React from 'react';

import { INSTANCE_NAME_CONFIG_KEY } from '../../utils/service_instance';

// Every service's settings form opens with the same field: the name of this
// instance, since a service can be configured more than once. It was copied into
// all 34 of them, which is 34 places to keep in step and 34 chances for one to
// drift.
//
// `config`/`onChange` rather than `value`/`onValueChange` so that callers do not
// each have to import `INSTANCE_NAME_CONFIG_KEY` and spread the config by hand.
export default function InstanceNameInput({ config, onChange }) {
    const { t } = useTranslation();

    return (
        <div className='config-item'>
            <TextField
                className='flex w-full justify-between'
                value={config[INSTANCE_NAME_CONFIG_KEY]}
                onChange={(value) => {
                    onChange({ ...config, [INSTANCE_NAME_CONFIG_KEY]: value });
                }}
            >
                <Label className='text-base my-auto'>{t('services.instance_name')}</Label>
                <Input
                    variant='secondary'
                    className='max-w-[50%]'
                />
            </TextField>
        </div>
    );
}
