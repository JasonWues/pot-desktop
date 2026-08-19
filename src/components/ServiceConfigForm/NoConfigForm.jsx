import { useTranslation } from 'react-i18next';
import { Button } from '@heroui/react';
import React from 'react';

// Nine services take no settings at all, and each shipped its own copy of this
// notice plus a save button that only has to register the service and close.
export default function NoConfigForm({ name, updateServiceList, onClose }) {
    const { t } = useTranslation();

    return (
        <>
            <div>{t('services.no_need')}</div>
            <div>
                <Button
                    variant='primary'
                    fullWidth
                    onPress={() => {
                        updateServiceList(name);
                        onClose();
                    }}
                >
                    {t('common.save')}
                </Button>
            </div>
        </>
    );
}
