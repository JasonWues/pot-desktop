import { INSTANCE_NAME_CONFIG_KEY } from '../../../../../utils/service_instance';
import { Button, Input, Dropdown, Label, TextField } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-shell';
import React from 'react';

import { useConfig } from '../../../../../hooks';

export function PluginConfig(props) {
    const { instanceKey, updateServiceList, onClose, name, pluginList } = props;
    const [pluginConfig, setPluginConfig] = useConfig(instanceKey, {}, { sync: false });
    const { t } = useTranslation();

    return (
        <>
            <div className={'config-item'}>
                <h3 className='my-auto select-none cursor-default'>{t('config.service.homepage')}</h3>
                <Button
                    onPress={() => {
                        open(pluginList[name].homepage);
                    }}
                >
                    {t('config.service.homepage')}
                </Button>
            </div>
            {pluginConfig && (
                <div className='config-item'>
                    <TextField
                        className='flex w-full flex-row items-center justify-between'
                        value={pluginConfig[INSTANCE_NAME_CONFIG_KEY] ?? pluginList[name].display}
                        onChange={(value) => {
                            setPluginConfig({
                                ...pluginConfig,
                                [INSTANCE_NAME_CONFIG_KEY]: value,
                            });
                        }}
                    >
                        <Label className='text-base my-auto'>{t('services.instance_name')}</Label>
                        <Input className='max-w-[50%]' />
                    </TextField>
                </div>
            )}

            {pluginList[name].needs.length === 0 ? (
                <div>{t('services.no_need')}</div>
            ) : (
                pluginList[name].needs.map((x) => {
                    return (
                        pluginConfig &&
                        (x.type ? (
                            <div
                                key={x.key}
                                className={`config-item`}
                            >
                                <h3 className='my-auto select-none cursor-default'>{x.display}</h3>
                                {x.type === 'input' && (
                                    <TextField
                                        className='flex w-full flex-row items-center justify-between max-w-[50%]'
                                        value={`${pluginConfig.hasOwnProperty(x.key) ? pluginConfig[x.key] : ''}`}
                                        onChange={(value) => {
                                            setPluginConfig({
                                                ...pluginConfig,
                                                [x.key]: value,
                                            });
                                        }}
                                        aria-label={x.display}
                                    >
                                        <Input />
                                    </TextField>
                                )}
                                {x.type === 'select' && (
                                    <Dropdown>
                                        <Button
                                            variant='outline'
                                            className='max-w-[50%]'
                                        >
                                            {
                                                x.options[
                                                    pluginConfig.hasOwnProperty(x.key)
                                                        ? pluginConfig[x.key]
                                                        : Object.keys(x.options)[0]
                                                ]
                                            }
                                        </Button>
                                        <Dropdown.Popover>
                                            <Dropdown.Menu
                                                aria-label={x.key}
                                                className='max-h-[40vh] overflow-y-auto'
                                                onAction={(key) => {
                                                    setPluginConfig({
                                                        ...pluginConfig,
                                                        [x.key]: key,
                                                    });
                                                }}
                                            >
                                                {Object.keys(x.options).map((y) => {
                                                    return (
                                                        <Dropdown.Item
                                                            key={y}
                                                            id={y}
                                                        >
                                                            <Label>{x.options[y]}</Label>
                                                        </Dropdown.Item>
                                                    );
                                                })}
                                            </Dropdown.Menu>
                                        </Dropdown.Popover>
                                    </Dropdown>
                                )}
                            </div>
                        ) : (
                            <div
                                key={x.key}
                                className={`config-item`}
                            >
                                <h3 className='my-auto select-none cursor-default'>{x.display}</h3>
                                <TextField
                                    className='flex w-full flex-row items-center justify-between max-w-[50%]'
                                    value={`${pluginConfig.hasOwnProperty(x.key) ? pluginConfig[x.key] : ''}`}
                                    onChange={(value) => {
                                        setPluginConfig({
                                            ...pluginConfig,
                                            [x.key]: value,
                                        });
                                    }}
                                    aria-label={x.display}
                                >
                                    <Input />
                                </TextField>
                            </div>
                        ))
                    );
                })
            )}

            <div>
                <Button
                    variant='primary'
                    fullWidth
                    onPress={() => {
                        setPluginConfig(pluginConfig, true);
                        updateServiceList(instanceKey);
                        onClose();
                    }}
                >
                    {t('common.save')}
                </Button>
            </div>
        </>
    );
}
