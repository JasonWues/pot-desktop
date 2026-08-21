import { Button, Dropdown, Input, Label, Switch, TextField } from '@heroui/react';
import { addGlossaryEntry, deleteGlossaryEntry, listGlossary, updateGlossaryEntry } from '../../../../utils/db';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { MdDeleteOutline } from 'react-icons/md';
import { useTranslation } from 'react-i18next';

import { languageList } from '../../../../utils/language';
import { useToastStyle } from '../../../../hooks';
import { osType } from '../../../../utils/env';

// 'all' is stored, not an empty string: a NOT NULL column with a real value in
// it is easier to read in a dump than one with two ways of saying "unscoped".
const ALL = 'all';

export default function Glossary() {
    const { t } = useTranslation();
    const toastStyle = useToastStyle();
    const [entries, setEntries] = useState(null);
    const [term, setTerm] = useState('');
    const [replacement, setReplacement] = useState('');
    const [fromLang, setFromLang] = useState(ALL);
    const [toLang, setToLang] = useState(ALL);

    const reload = () => listGlossary().then(setEntries);

    useEffect(() => {
        reload().catch((e) => toast.error(e.toString(), { style: toastStyle }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const languageLabel = (code) =>
        code === ALL ? t('config.glossary.any_language') : t(`languages.${code}`, { defaultValue: code });

    const submit = async (e) => {
        e.preventDefault();
        if (term.trim() === '') return;
        try {
            await addGlossaryEntry({
                term: term.trim(),
                replacement: replacement.trim(),
                fromLang,
                toLang,
            });
            setTerm('');
            setReplacement('');
            await reload();
        } catch (err) {
            toast.error(err.toString(), { style: toastStyle });
        }
    };

    const toggle = async (entry, enabled) => {
        try {
            await updateGlossaryEntry(entry.id, {
                term: entry.term,
                replacement: entry.replacement,
                fromLang: entry.from_lang,
                toLang: entry.to_lang,
                enabled,
            });
            await reload();
        } catch (err) {
            toast.error(err.toString(), { style: toastStyle });
        }
    };

    const remove = async (id) => {
        try {
            await deleteGlossaryEntry(id);
            await reload();
        } catch (err) {
            toast.error(err.toString(), { style: toastStyle });
        }
    };

    // A scope dropdown. Both ends offer the same list plus the wildcard, so this
    // is written once rather than twice with the labels swapped.
    const scopePicker = (value, onChange, ariaLabel) => (
        <Dropdown>
            <Button
                size='sm'
                variant='outline'
            >
                {languageLabel(value)}
            </Button>
            <Dropdown.Popover>
                <Dropdown.Menu
                    aria-label={ariaLabel}
                    className='max-h-[50vh] overflow-y-auto'
                    onAction={(key) => onChange(key)}
                >
                    <Dropdown.Item
                        key={ALL}
                        id={ALL}
                    >
                        <Label>{languageLabel(ALL)}</Label>
                    </Dropdown.Item>
                    {languageList.map((code) => (
                        <Dropdown.Item
                            key={code}
                            id={code}
                        >
                            <Label>{languageLabel(code)}</Label>
                        </Dropdown.Item>
                    ))}
                </Dropdown.Menu>
            </Dropdown.Popover>
        </Dropdown>
    );

    return (
        entries !== null && (
            <div className={`flex flex-col ${osType === 'Linux' ? 'h-[calc(100vh-58px)]' : 'h-[calc(100vh-56px)]'}`}>
                <form
                    className='glossary-add'
                    onSubmit={submit}
                >
                    <TextField
                        className='glossary-add__field'
                        value={term}
                        onChange={setTerm}
                        aria-label={t('config.glossary.term')}
                    >
                        <Input placeholder={t('config.glossary.term')} />
                    </TextField>
                    <span className='glossary-add__arrow'>→</span>
                    <TextField
                        className='glossary-add__field'
                        value={replacement}
                        onChange={setReplacement}
                        aria-label={t('config.glossary.replacement')}
                    >
                        <Input placeholder={t('config.glossary.replacement')} />
                    </TextField>
                    {scopePicker(fromLang, setFromLang, 'source scope')}
                    {scopePicker(toLang, setToLang, 'target scope')}
                    <Button
                        size='sm'
                        variant='primary'
                        type='submit'
                        isDisabled={term.trim() === ''}
                    >
                        {t('config.glossary.add')}
                    </Button>
                </form>

                <div className='flat-note glossary-note'>{t('config.glossary.note')}</div>

                <div className='glossary-list'>
                    {entries.length === 0 && <div className='glossary-empty'>{t('config.glossary.empty')}</div>}
                    {entries.map((entry) => (
                        <div
                            key={entry.id}
                            className={`glossary-entry${entry.enabled ? '' : ' glossary-entry--off'}`}
                        >
                            <div className='glossary-entry__pair'>
                                <span className='glossary-entry__term'>{entry.term}</span>
                                <span className='glossary-entry__arrow'>→</span>
                                <span className='glossary-entry__replacement'>{entry.replacement}</span>
                            </div>
                            <span className='flat-meta glossary-entry__scope'>
                                {languageLabel(entry.from_lang)} → {languageLabel(entry.to_lang)}
                            </span>
                            <Switch
                                isSelected={Boolean(entry.enabled)}
                                onChange={(enabled) => toggle(entry, enabled)}
                                aria-label={t('config.glossary.enabled')}
                            >
                                <Switch.Content>
                                    <Switch.Control>
                                        <Switch.Thumb />
                                    </Switch.Control>
                                </Switch.Content>
                            </Switch>
                            <button
                                type='button'
                                className='flat-action flat-action--danger'
                                onClick={() => remove(entry.id)}
                                aria-label={t('config.glossary.delete')}
                            >
                                <MdDeleteOutline />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        )
    );
}
