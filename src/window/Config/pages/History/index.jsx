import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from '@heroui/react';
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from '@heroui/react';
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@heroui/react';
import { readDir, BaseDirectory, readTextFile, exists } from '@tauri-apps/plugin-fs';
import { Textarea, Button, ButtonGroup, Input } from '@heroui/react';
import { appConfigDir, join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/core';
import React, { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { save } from '@tauri-apps/plugin-dialog';
import { Pagination } from '@heroui/react';
import { MdDeleteOutline } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';

import * as builtinCollectionServices from '../../../../services/collection';
import { invoke_plugin } from '../../../../utils/invoke_plugin';
import * as builtinServices from '../../../../services/translate';
import { useConfig, useToastStyle } from '../../../../hooks';
import { LanguageFlag } from '../../../../utils/language';
import { getDatabase } from '../../../../utils/db';
import { store } from '../../../../utils/store';
import { osType } from '../../../../utils/env';
import {
    ServiceSourceType,
    ServiceType,
    getServiceName,
    getServiceSouceType,
    whetherAvailableService,
} from '../../../../utils/service_instance';

const PAGE_SIZE = 20;
const ALL = '__all__';

// `text`/`result` come straight from the user, so every field is quoted and
// embedded quotes are doubled. The BOM makes Excel read it as UTF-8.
function toCsv(rows) {
    const columns = ['id', 'text', 'source', 'target', 'service', 'result', 'timestamp'];
    const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const lines = [columns.join(',')];
    for (const row of rows) {
        lines.push(
            columns
                .map((column) => escape(column === 'timestamp' ? new Date(row.timestamp).toISOString() : row[column]))
                .join(',')
        );
    }
    return '\uFEFF' + lines.join('\r\n');
}

export default function History() {
    const [collectionServiceList] = useConfig('collection_service_list', []);
    const { isOpen, onOpen, onOpenChange } = useDisclosure();
    const [pluginList, setPluginList] = useState(null);
    const [selectedItem, setSelectItem] = useState(null);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [items, setItems] = useState([]);
    const [search, setSearch] = useState('');
    const [serviceFilter, setServiceFilter] = useState(ALL);
    const [targetFilter, setTargetFilter] = useState(ALL);
    const [serviceOptions, setServiceOptions] = useState([]);
    const [targetOptions, setTargetOptions] = useState([]);
    const toastStyle = useToastStyle();
    const { t } = useTranslation();

    useEffect(() => {
        loadPluginList();
    }, []);

    // Filter changes restart paging; without this a narrowed result set can
    // leave the view on a page that no longer exists.
    useEffect(() => {
        setPage(1);
    }, [search, serviceFilter, targetFilter]);

    useEffect(() => {
        // Debounced because this also runs on every keystroke in the search box.
        const timer = setTimeout(() => {
            getData();
            loadFilterOptions();
        }, 250);
        return () => clearTimeout(timer);
    }, [search, serviceFilter, targetFilter, page]);

    // Builds the shared WHERE clause. sqlite takes positional `$n` parameters,
    // so the index has to track the params array as it grows.
    const buildFilter = () => {
        const clauses = [];
        const params = [];
        const keyword = search.trim();
        if (keyword !== '') {
            params.push(`%${keyword}%`, `%${keyword}%`);
            clauses.push(`(text LIKE $${params.length - 1} OR result LIKE $${params.length})`);
        }
        if (serviceFilter !== ALL) {
            params.push(serviceFilter);
            clauses.push(`service = $${params.length}`);
        }
        if (targetFilter !== ALL) {
            params.push(targetFilter);
            clauses.push(`target = $${params.length}`);
        }
        return { where: clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '', params };
    };

    const getData = async () => {
        try {
            const db = await getDatabase();
            const { where, params } = buildFilter();
            const countRows = await db.select(`SELECT COUNT(*) AS count FROM history${where}`, params);
            setTotal(countRows[0]?.count ?? 0);
            const rows = await db.select(
                `SELECT * FROM history${where} ORDER BY timestamp DESC, id DESC LIMIT $${params.length + 1} OFFSET $${
                    params.length + 2
                }`,
                [...params, PAGE_SIZE, PAGE_SIZE * (page - 1)]
            );
            setItems(rows);
        } catch (e) {
            toast.error(e.toString(), { style: toastStyle });
        }
    };

    // Only offer filters that actually match something in the table.
    const loadFilterOptions = async () => {
        try {
            const db = await getDatabase();
            const services = await db.select('SELECT DISTINCT service FROM history ORDER BY service');
            setServiceOptions(services.map((row) => row.service));
            const targets = await db.select('SELECT DISTINCT target FROM history ORDER BY target');
            setTargetOptions(targets.map((row) => row.target));
        } catch {
            setServiceOptions([]);
            setTargetOptions([]);
        }
    };

    const getSelectedData = async (id) => {
        const db = await getDatabase();
        let result = await db.select('SELECT * FROM history WHERE id=$1', [id]);
        setSelectItem(result[0]);
    };

    const clearData = async () => {
        const db = await getDatabase();
        // DELETE rather than DROP: the table has to survive so the next
        // translation does not have to recreate it.
        await db.execute('DELETE FROM history');
        await db.execute('VACUUM');
        setItems([]);
        setTotal(0);
        setPage(1);
        setServiceOptions([]);
        setTargetOptions([]);
    };

    const deleteItem = async (id) => {
        const db = await getDatabase();
        await db.execute('DELETE FROM history WHERE id=$1', [id]);
        await getData();
        await loadFilterOptions();
    };

    const updateData = async () => {
        const db = await getDatabase();
        await db.execute('UPDATE history SET text=$1, result=$2 WHERE id=$3', [
            selectedItem.text,
            selectedItem.result,
            selectedItem.id,
        ]);
        await getData();
    };

    // Exports everything the current filters match, not just the visible page.
    const exportData = async (format) => {
        try {
            const selected = await save({
                defaultPath: `pot-history.${format}`,
                filters: [{ name: format.toUpperCase(), extensions: [format] }],
            });
            if (selected === null) {
                return;
            }
            const db = await getDatabase();
            const { where, params } = buildFilter();
            const rows = await db.select(`SELECT * FROM history${where} ORDER BY timestamp DESC, id DESC`, params);
            const content = format === 'csv' ? toCsv(rows) : JSON.stringify(rows, null, 2);
            await invoke('export_history', { path: selected, content });
            toast.success(t('config.history.export_success'), { style: toastStyle });
        } catch (e) {
            toast.error(e.toString(), { style: toastStyle });
        }
    };

    const formatDate = (date) => {
        function padTo2Digits(num) {
            return num.toString().padStart(2, '0');
        }
        const year = date.getFullYear().toString().slice(2, 4);
        const month = padTo2Digits(date.getMonth() + 1);
        const day = padTo2Digits(date.getDate());
        const hour = padTo2Digits(date.getHours());
        const minute = padTo2Digits(date.getMinutes());
        const second = padTo2Digits(date.getSeconds());
        return `${year}/${month}/${day} ${hour}:${minute}:${second}`;
    };

    const serviceLabel = (service) => {
        const name = getServiceName(service);
        if (getServiceSouceType(service) === ServiceSourceType.PLUGIN) {
            return pluginList?.['translate']?.[name]?.display ?? name;
        }
        return t(`services.translate.${name}.title`, { defaultValue: name });
    };

    const loadPluginList = async () => {
        const serviceTypeList = ['translate', 'collection'];
        let temp = {};
        for (const serviceType of serviceTypeList) {
            temp[serviceType] = {};
            if (await exists(`plugins/${serviceType}`, { baseDir: BaseDirectory.AppConfig })) {
                const plugins = await readDir(`plugins/${serviceType}`, { baseDir: BaseDirectory.AppConfig });
                for (const plugin of plugins) {
                    const infoStr = await readTextFile(`plugins/${serviceType}/${plugin.name}/info.json`, {
                        baseDir: BaseDirectory.AppConfig,
                    });
                    let pluginInfo = JSON.parse(infoStr);
                    if ('icon' in pluginInfo) {
                        const appConfigDirPath = await appConfigDir();
                        const iconPath = await join(
                            appConfigDirPath,
                            `/plugins/${serviceType}/${plugin.name}/${pluginInfo.icon}`
                        );
                        pluginInfo.icon = convertFileSrc(iconPath);
                    }
                    temp[serviceType][plugin.name] = pluginInfo;
                }
            }
        }
        setPluginList({ ...temp });
    };

    return (
        pluginList !== null && (
            <>
                <Toaster />
                <div className='flex gap-[8px] mb-[8px]'>
                    <Input
                        size='sm'
                        isClearable
                        variant='bordered'
                        className='max-w-[40%]'
                        placeholder={t('config.history.search')}
                        value={search}
                        onValueChange={setSearch}
                        onClear={() => setSearch('')}
                    />
                    <Dropdown>
                        <DropdownTrigger>
                            <Button
                                size='sm'
                                variant='bordered'
                                className='my-auto'
                            >
                                {serviceFilter === ALL ? t('config.history.all_services') : serviceLabel(serviceFilter)}
                            </Button>
                        </DropdownTrigger>
                        <DropdownMenu
                            aria-label='service filter'
                            className='max-h-[50vh] overflow-y-auto'
                            onAction={(key) => setServiceFilter(key)}
                        >
                            <DropdownItem key={ALL}>{t('config.history.all_services')}</DropdownItem>
                            {serviceOptions.map((service) => (
                                <DropdownItem key={service}>{serviceLabel(service)}</DropdownItem>
                            ))}
                        </DropdownMenu>
                    </Dropdown>
                    <Dropdown>
                        <DropdownTrigger>
                            <Button
                                size='sm'
                                variant='bordered'
                                className='my-auto'
                            >
                                {targetFilter === ALL
                                    ? t('config.history.all_languages')
                                    : t(`languages.${targetFilter}`, { defaultValue: targetFilter })}
                            </Button>
                        </DropdownTrigger>
                        <DropdownMenu
                            aria-label='language filter'
                            className='max-h-[50vh] overflow-y-auto'
                            onAction={(key) => setTargetFilter(key)}
                        >
                            <DropdownItem key={ALL}>{t('config.history.all_languages')}</DropdownItem>
                            {targetOptions.map((language) => (
                                <DropdownItem key={language}>
                                    {t(`languages.${language}`, { defaultValue: language })}
                                </DropdownItem>
                            ))}
                        </DropdownMenu>
                    </Dropdown>
                </div>
                <Table
                    fullWidth
                    hideHeader
                    selectionMode='single'
                    selectionBehavior='toggle'
                    aria-label='History Table'
                    classNames={{
                        base: `${
                            osType === 'Linux' ? 'h-[calc(100vh-180px)]' : 'h-[calc(100vh-150px)]'
                        } overflow-y-auto`,
                        td: 'px-0',
                    }}
                    onRowAction={(id) => {
                        getSelectedData(id);
                        onOpen();
                    }}
                >
                    <TableHeader>
                        <TableColumn key='service' />
                        <TableColumn key='text' />
                        <TableColumn key='source' />
                        <TableColumn key='target' />
                        <TableColumn key='result' />
                        <TableColumn key='timestamp' />
                    </TableHeader>
                    <TableBody
                        emptyContent={'No History to display.'}
                        items={items}
                    >
                        {(item) =>
                            whetherAvailableService(item.service, {
                                [ServiceSourceType.BUILDIN]: builtinServices,
                                [ServiceSourceType.PLUGIN]: pluginList[ServiceType.TRANSLATE],
                            }) && (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        {getServiceSouceType(item.service) === ServiceSourceType.PLUGIN ? (
                                            <img
                                                src={pluginList['translate'][getServiceName(item.service)].icon}
                                                className='h-[18px] w-[18px] my-auto mr-[8px]'
                                                draggable={false}
                                            />
                                        ) : (
                                            <img
                                                src={`${builtinServices[getServiceName(item.service)].info.icon}`}
                                                className='h-[18px] w-[18px] my-auto mr-[8px]'
                                                draggable={false}
                                            />
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <p
                                            className={`whitespace-nowrap ${
                                                osType === 'Linux'
                                                    ? 'w-[calc((100vw-287px-26px-60px-140px-30px)*0.5)]'
                                                    : 'w-[calc((100vw-287px-26px-60px-140px)*0.5)]'
                                            } text-ellipsis overflow-hidden`}
                                        >
                                            {item.text}
                                        </p>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`w-[30px] fi fi-${LanguageFlag[item.source]}`} />
                                    </TableCell>
                                    <TableCell>
                                        <span className={`w-[30px] fi fi-${LanguageFlag[item.target]}`} />
                                    </TableCell>
                                    <TableCell>
                                        <p
                                            className={`whitespace-nowrap ${
                                                osType === 'Linux'
                                                    ? 'w-[calc((100vw-287px-26px-60px-140px-30px)*0.5)]'
                                                    : 'w-[calc((100vw-287px-26px-60px-140px)*0.5)]'
                                            } text-ellipsis overflow-hidden`}
                                        >
                                            {item.result}
                                        </p>
                                    </TableCell>
                                    <TableCell>
                                        <p className='text-center whitespace-nowrap w-[140px]'>
                                            {formatDate(new Date(item.timestamp))}
                                        </p>
                                    </TableCell>
                                </TableRow>
                            )
                        }
                    </TableBody>
                </Table>
                <div className='mt-[8px] flex justify-around'>
                    <Pagination
                        showControls
                        isCompact
                        total={Math.ceil(total / PAGE_SIZE)}
                        page={page}
                        onChange={setPage}
                    />
                    <ButtonGroup className='my-auto'>
                        <Button
                            size='sm'
                            onPress={() => exportData('csv')}
                        >
                            {t('config.history.export_csv')}
                        </Button>
                        <Button
                            size='sm'
                            onPress={() => exportData('json')}
                        >
                            {t('config.history.export_json')}
                        </Button>
                    </ButtonGroup>
                    <Button
                        size='sm'
                        className='my-auto'
                        onPress={clearData}
                    >
                        {t('common.clear')}
                    </Button>
                </div>

                <Modal
                    isOpen={isOpen}
                    onOpenChange={onOpenChange}
                    scrollBehavior='inside'
                >
                    <ModalContent className='max-h-[80vh]'>
                        {(onClose) =>
                            selectedItem && (
                                <>
                                    <ModalHeader>
                                        <div className='flex justify-start'>
                                            {getServiceSouceType(selectedItem.service) === ServiceSourceType.PLUGIN ? (
                                                <img
                                                    src={
                                                        pluginList['translate'][getServiceName(selectedItem.service)]
                                                            .icon
                                                    }
                                                    className='h-[24px] w-[24px] my-auto'
                                                    draggable={false}
                                                />
                                            ) : (
                                                <img
                                                    src={`${builtinServices[getServiceName(selectedItem.service)].info.icon}`}
                                                    className='h-[24px] w-[24px] m-auto mr-[8px]'
                                                    draggable={false}
                                                />
                                            )}
                                        </div>
                                    </ModalHeader>
                                    <ModalBody>
                                        <Textarea
                                            value={selectedItem.text}
                                            onChange={(e) => {
                                                setSelectItem({ ...selectedItem, text: e.target.value });
                                            }}
                                        />
                                        <Textarea
                                            value={selectedItem.result}
                                            onChange={(e) => {
                                                setSelectItem({ ...selectedItem, result: e.target.value });
                                            }}
                                        />
                                    </ModalBody>
                                    <ModalFooter className='flex justify-between'>
                                        <ButtonGroup>
                                            <Button
                                                color='primary'
                                                onPress={async () => {
                                                    await updateData();
                                                    onClose();
                                                }}
                                            >
                                                {t('common.save')}
                                            </Button>
                                            <Button
                                                isIconOnly
                                                color='danger'
                                                variant='flat'
                                                aria-label={t('config.history.delete')}
                                                onPress={async () => {
                                                    await deleteItem(selectedItem.id);
                                                    onClose();
                                                }}
                                            >
                                                <MdDeleteOutline />
                                            </Button>
                                        </ButtonGroup>
                                        <ButtonGroup>
                                            {collectionServiceList &&
                                                collectionServiceList.map((instanceKey) => {
                                                    return (
                                                        <Button
                                                            key={instanceKey}
                                                            isIconOnly
                                                            variant='light'
                                                            onPress={async () => {
                                                                if (
                                                                    getServiceSouceType(instanceKey) ===
                                                                    ServiceSourceType.PLUGIN
                                                                ) {
                                                                    const pluginConfig =
                                                                        (await store.get(instanceKey)) ?? {};
                                                                    let [func, utils] = await invoke_plugin(
                                                                        'collection',
                                                                        getServiceName(instanceKey)
                                                                    );
                                                                    func(selectedItem.text, selectedItem.result, {
                                                                        config: pluginConfig,
                                                                        utils,
                                                                    }).then(
                                                                        (_) => {
                                                                            toast.success(
                                                                                t('translate.add_collection_success'),
                                                                                {
                                                                                    style: toastStyle,
                                                                                }
                                                                            );
                                                                        },
                                                                        (e) => {
                                                                            toast.error(e.toString(), {
                                                                                style: toastStyle,
                                                                            });
                                                                        }
                                                                    );
                                                                } else {
                                                                    const instanceConfig =
                                                                        (await store.get(instanceKey)) ?? {};
                                                                    builtinCollectionServices[
                                                                        getServiceName(instanceKey)
                                                                    ]
                                                                        .collection(
                                                                            selectedItem.text,
                                                                            selectedItem.result,
                                                                            {
                                                                                config: instanceConfig,
                                                                            }
                                                                        )
                                                                        .then(
                                                                            (_) => {
                                                                                toast.success(
                                                                                    t(
                                                                                        'translate.add_collection_success'
                                                                                    ),
                                                                                    {
                                                                                        style: toastStyle,
                                                                                    }
                                                                                );
                                                                            },
                                                                            (e) => {
                                                                                toast.error(e.toString(), {
                                                                                    style: toastStyle,
                                                                                });
                                                                            }
                                                                        );
                                                                }
                                                            }}
                                                        >
                                                            <img
                                                                src={
                                                                    getServiceSouceType(instanceKey) ===
                                                                    ServiceSourceType.PLUGIN
                                                                        ? pluginList['collection'][
                                                                              getServiceName(instanceKey)
                                                                          ].icon
                                                                        : builtinCollectionServices[
                                                                              getServiceName(instanceKey)
                                                                          ].info.icon
                                                                }
                                                                className='h-[24px] w-[24px]'
                                                            />
                                                        </Button>
                                                    );
                                                })}
                                        </ButtonGroup>
                                    </ModalFooter>
                                </>
                            )
                        }
                    </ModalContent>
                </Modal>
            </>
        )
    );
}
