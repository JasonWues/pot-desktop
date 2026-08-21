import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import { Button } from '@heroui/react';

import { useConfig } from '../../hooks/useConfig';
import InstanceNameInput from '../InstanceNameInput';
import { useToastStyle } from '../../hooks';

// Every service settings form was the same wiring around a handful of fields:
// load this instance's config, test-call the service on submit, persist and
// close on success, toast the thrown string on failure. That was copied into
// thirty-odd files, so a fix to any of it had to be made thirty-odd times.
//
// `children` is a render prop rather than plain nodes because the fields need
// the config this component owns -- `(config, setConfig) => nodes`.
//
// `onTest` receives that same config and returns the service's promise. It is
// what decides whether the settings are saved at all: the config is only
// written back (`setConfig(config, true)` -- forced, since the hook is created
// with `sync: false`) once the call resolves.
export default function ServiceConfigForm(props) {
    const { instanceKey, defaultConfig, onTest, updateServiceList, onClose, children } = props;
    const { t } = useTranslation();
    const [storedConfig, setConfig] = useConfig(instanceKey, defaultConfig, { sync: false });
    const [isLoading, setIsLoading] = useState(false);

    const toastStyle = useToastStyle();

    // `useConfig` seeds the defaults only when the key is absent altogether, and
    // several instances exist with a partial config -- a service that was
    // switched off before it was ever configured is stored as `{enable: false}`
    // and nothing else. The fields then read `undefined` out of it, which shows
    // as a dropdown with no label on it. Filling the gaps here means every field
    // sees the value its own service documented as the default, and a save
    // writes the whole config back rather than the fragment it started from.
    const config = storedConfig === null ? null : { ...defaultConfig, ...storedConfig };

    return (
        config !== null && (
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    setIsLoading(true);
                    onTest(config).then(
                        () => {
                            setIsLoading(false);
                            setConfig(config, true);
                            updateServiceList(instanceKey);
                            onClose();
                        },
                        (e) => {
                            setIsLoading(false);
                            toast.error(t('config.service.test_failed') + e.toString(), { style: toastStyle });
                        }
                    );
                }}
            >
                <InstanceNameInput
                    config={config}
                    onChange={setConfig}
                />
                {children(config, setConfig)}
                <Button
                    variant='primary'
                    type='submit'
                    isPending={isLoading}
                    fullWidth
                >
                    {t('common.save')}
                </Button>
            </form>
        )
    );
}
