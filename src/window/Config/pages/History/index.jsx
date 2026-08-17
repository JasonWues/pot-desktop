import {
    Modal,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Table,
    TableHeader,
    Dropdown,
    TextArea,
    Button,
    ButtonGroup,
    Input,
    Pagination,
    Label,
    SearchField,
} from '@heroui/react';
import { readDir, BaseDirectory, readTextFile, exists } from '@tauri-apps/plugin-fs';
import { appConfigDir, join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/core';
import React, { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { save } from '@tauri-apps/plugin-dialog';
import { MdDeleteOutline } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';

import * as builtinCollectionServices from '../../../../services/collection';
import { invoke_plugin } from '../../../../utils/invoke_plugin';
import * as builtinServices from '../../../../services/translate';
import { useConfig, useToastStyle, useDisclosure } from '../../../../hooks';
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

const ELLIPSIS = Symbol('ellipsis');

// The page numbers to actually draw. v3's Pagination has no notion of collapsing
// a long run, so this is what v2's `isCompact` did on its own: first and last
// always, a window either side of the current page, and an ellipsis for each gap.
function pageWindow(current, totalPages) {
    if (!Number.isFinite(totalPages) || totalPages < 1) {
        return [1];
    }
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = new Set([1, totalPages, current, current - 1, current + 1]);
    const shown = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
    const out = [];
    let previous = 0;
    for (const p of shown) {
        if (p - previous > 1) {
            out.push(ELLIPSIS);
        }
        out.push(p);
        previous = p;
    }
    return out;
}

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
                    {/* SearchField, not Input: v3 dropped `isClearable`/`onClear`,
                        and this is the component that carries a clear button of its
                        own. Clearing goes through `onChange` like any other edit, so
                        the separate `onClear` handler is no longer needed. */}
                    <SearchField
                        className='max-w-[40%]'
                        value={search}
                        onChange={setSearch}
                        aria-label={t('config.history.search')}
                    >
                        <SearchField.Group>
                            <SearchField.SearchIcon />
                            <SearchField.Input placeholder={t('config.history.search')} />
                            <SearchField.ClearButton />
                        </SearchField.Group>
                    </SearchField>
                    <Dropdown>
                        <Button
                            size='sm'
                            variant='outline'
                            className='my-auto'
                        >
                            {serviceFilter === ALL ? t('config.history.all_services') : serviceLabel(serviceFilter)}
                        </Button>
                        <Dropdown.Popover>
                            <Dropdown.Menu
                                aria-label='service filter'
                                className='max-h-[50vh] overflow-y-auto'
                                onAction={(key) => setServiceFilter(key)}
                            >
                                <Dropdown.Item
                                    key={ALL}
                                    id={ALL}
                                >
                                    <Label>{t('config.history.all_services')}</Label>
                                </Dropdown.Item>
                                {serviceOptions.map((service) => (
                                    <Dropdown.Item
                                        key={service}
                                        id={service}
                                    >
                                        <Label>{serviceLabel(service)}</Label>
                                    </Dropdown.Item>
                                ))}
                            </Dropdown.Menu>
                        </Dropdown.Popover>
                    </Dropdown>
                    <Dropdown>
                        <Button
                            size='sm'
                            variant='outline'
                            className='my-auto'
                        >
                            {targetFilter === ALL
                                ? t('config.history.all_languages')
                                : t(`languages.${targetFilter}`, { defaultValue: targetFilter })}
                        </Button>
                        <Dropdown.Popover>
                            <Dropdown.Menu
                                aria-label='language filter'
                                className='max-h-[50vh] overflow-y-auto'
                                onAction={(key) => setTargetFilter(key)}
                            >
                                <Dropdown.Item
                                    key={ALL}
                                    id={ALL}
                                >
                                    <Label>{t('config.history.all_languages')}</Label>
                                </Dropdown.Item>
                                {targetOptions.map((language) => (
                                    <Dropdown.Item
                                        key={language}
                                        id={language}
                                    >
                                        {t(`languages.${language}`, { defaultValue: language })}
                                    </Dropdown.Item>
                                ))}
                            </Dropdown.Menu>
                        </Dropdown.Popover>
                    </Dropdown>
                </div>
                {/* v3's Table is three components, not one: the root styles the
                    container, ScrollContainer owns the scrolling, and Content is
                    the actual table -- which is where aria-label, selectionMode and
                    onRowAction now live. Getting this wrong does not fail the
                    build: the flat TableHeader/TableRow/TableCell names still
                    exist, and are literally the same objects, so the v2
                    arrangement compiled and then threw "cannot be rendered outside
                    a collection" the moment this page opened.

                    Columns and rows are keyed by `id` rather than React's `key`,
                    the same distinction the dropdown items have. */}
                <Table
                    className={`${
                        osType === 'Linux' ? 'h-[calc(100vh-180px)]' : 'h-[calc(100vh-150px)]'
                    } overflow-y-auto`}
                >
                    <Table.ScrollContainer>
                        <Table.Content
                            hideHeader
                            selectionMode='single'
                            selectionBehavior='toggle'
                            aria-label='History Table'
                            onRowAction={(id) => {
                                getSelectedData(id);
                                onOpen();
                            }}
                        >
                            <Table.Header>
                                <Table.Column id='service' />
                                <Table.Column id='text' />
                                <Table.Column id='source' />
                                <Table.Column id='target' />
                                <Table.Column id='result' />
                                <Table.Column id='timestamp' />
                            </Table.Header>
                            <Table.Body
                                renderEmptyState={() => 'No History to display.'}
                                items={items}
                            >
                                {(item) =>
                                    whetherAvailableService(item.service, {
                                        [ServiceSourceType.BUILDIN]: builtinServices,
                                        [ServiceSourceType.PLUGIN]: pluginList[ServiceType.TRANSLATE],
                                    }) && (
                                        <Table.Row id={item.id}>
                                            <Table.Cell className='px-0'>
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
                                            </Table.Cell>
                                            <Table.Cell className='px-0'>
                                                <p
                                                    className={`whitespace-nowrap ${
                                                        osType === 'Linux'
                                                            ? 'w-[calc((100vw-287px-26px-60px-140px-30px)*0.5)]'
                                                            : 'w-[calc((100vw-287px-26px-60px-140px)*0.5)]'
                                                    } text-ellipsis overflow-hidden`}
                                                >
                                                    {item.text}
                                                </p>
                                            </Table.Cell>
                                            <Table.Cell className='px-0'>
                                                <span className={`w-[30px] fi fi-${LanguageFlag[item.source]}`} />
                                            </Table.Cell>
                                            <Table.Cell className='px-0'>
                                                <span className={`w-[30px] fi fi-${LanguageFlag[item.target]}`} />
                                            </Table.Cell>
                                            <Table.Cell className='px-0'>
                                                <p
                                                    className={`whitespace-nowrap ${
                                                        osType === 'Linux'
                                                            ? 'w-[calc((100vw-287px-26px-60px-140px-30px)*0.5)]'
                                                            : 'w-[calc((100vw-287px-26px-60px-140px)*0.5)]'
                                                    } text-ellipsis overflow-hidden`}
                                                >
                                                    {item.result}
                                                </p>
                                            </Table.Cell>
                                            <Table.Cell className='px-0'>
                                                <p className='text-center whitespace-nowrap w-[140px]'>
                                                    {formatDate(new Date(item.timestamp))}
                                                </p>
                                            </Table.Cell>
                                        </Table.Row>
                                    )
                                }
                            </Table.Body>
                        </Table.Content>
                    </Table.ScrollContainer>
                </Table>
                <div className='mt-[8px] flex justify-around'>
                    {/* v3's Pagination renders no pages of its own: `total`, `page`
                        and `onChange` are gone and every link is written out. With
                        none, it produced an empty <nav> with `total` and `page`
                        leaked onto it as DOM attributes.

                        `pageWindow` is what v2's `isCompact` did for free -- keep
                        the run short and stand in an ellipsis -- since a history
                        of any size would otherwise print every page number. */}
                    <Pagination>
                        <Pagination.Content>
                            <Pagination.Item>
                                <Pagination.Previous
                                    isDisabled={page <= 1}
                                    onPress={() => setPage(page - 1)}
                                >
                                    <Pagination.PreviousIcon />
                                </Pagination.Previous>
                            </Pagination.Item>
                            {pageWindow(page, Math.ceil(total / PAGE_SIZE)).map((entry, index) => (
                                <Pagination.Item key={entry === ELLIPSIS ? `gap-${index}` : entry}>
                                    {entry === ELLIPSIS ? (
                                        <Pagination.Ellipsis />
                                    ) : (
                                        <Pagination.Link
                                            isActive={entry === page}
                                            onPress={() => setPage(entry)}
                                        >
                                            {entry}
                                        </Pagination.Link>
                                    )}
                                </Pagination.Item>
                            ))}
                            <Pagination.Item>
                                <Pagination.Next
                                    isDisabled={page >= Math.ceil(total / PAGE_SIZE)}
                                    onPress={() => setPage(page + 1)}
                                >
                                    <Pagination.NextIcon />
                                </Pagination.Next>
                            </Pagination.Item>
                        </Pagination.Content>
                    </Pagination>
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

                <Modal>
                    <Modal.Backdrop
                        isOpen={isOpen}
                        onOpenChange={onOpenChange}
                    >
                        <Modal.Container scroll='inside'>
                            <Modal.Dialog className='max-h-[80vh]'>
                                {({ close }) =>
                                    selectedItem && (
                                        <>
                                            <ModalHeader>
                                                <div className='flex justify-start'>
                                                    {getServiceSouceType(selectedItem.service) ===
                                                    ServiceSourceType.PLUGIN ? (
                                                        <img
                                                            src={
                                                                pluginList['translate'][
                                                                    getServiceName(selectedItem.service)
                                                                ].icon
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
                                                <TextArea
                                                    value={selectedItem.text}
                                                    onChange={(e) => {
                                                        setSelectItem({ ...selectedItem, text: e.target.value });
                                                    }}
                                                />
                                                <TextArea
                                                    value={selectedItem.result}
                                                    onChange={(e) => {
                                                        setSelectItem({ ...selectedItem, result: e.target.value });
                                                    }}
                                                />
                                            </ModalBody>
                                            <ModalFooter className='flex justify-between'>
                                                <ButtonGroup>
                                                    <Button
                                                        variant='primary'
                                                        onPress={async () => {
                                                            await updateData();
                                                            close();
                                                        }}
                                                    >
                                                        {t('common.save')}
                                                    </Button>
                                                    <Button
                                                        isIconOnly
                                                        variant='danger-soft'
                                                        aria-label={t('config.history.delete')}
                                                        onPress={async () => {
                                                            await deleteItem(selectedItem.id);
                                                            close();
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
                                                                    variant='tertiary'
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
                                                                            func(
                                                                                selectedItem.text,
                                                                                selectedItem.result,
                                                                                {
                                                                                    config: pluginConfig,
                                                                                    utils,
                                                                                }
                                                                            ).then(
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
                            </Modal.Dialog>
                        </Modal.Container>
                    </Modal.Backdrop>
                </Modal>
            </>
        )
    );
}
