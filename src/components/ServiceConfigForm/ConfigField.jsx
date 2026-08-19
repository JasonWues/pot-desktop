import { Button, Dropdown, Input, Label, Switch, TextArea, TextField } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-shell';
import React from 'react';

// The rows a service settings form is built out of. Each one reproduces the
// markup that used to be pasted into every Config.jsx, so the layout rules in
// `src/window/Config/style.css` keep applying unchanged.
//
// `hidden` is a prop rather than a wrapper element on purpose: `.config-item`
// is `display: flex`, and the way a row is hidden here is by putting Tailwind's
// `.hidden` utility on that same element -- an extra wrapping div would leave
// the flex row visible inside it.
export function ConfigItem({ hidden = false, children }) {
    return <div className={`config-item ${hidden ? 'hidden' : ''}`}>{children}</div>;
}

// A labelled text box. `type` is passed through, so `type='password'` masks an
// API key and `type='number'` gives a port field its spinner; leaving it off
// emits no attribute at all, exactly like the hand-written rows did.
export function TextConfigField({ label, value, onChange, type, placeholder, hidden = false }) {
    return (
        <ConfigItem hidden={hidden}>
            <TextField
                className='flex w-full flex-row items-center justify-between'
                value={value}
                onChange={onChange}
            >
                <Label className='text-base my-auto'>{label}</Label>
                <Input
                    type={type}
                    placeholder={placeholder}
                    className='max-w-[50%]'
                />
            </TextField>
        </ConfigItem>
    );
}

// A multi-line box: a prompt, or a blob of JSON request arguments. The label is
// optional -- the rows that have none pass `ariaLabel` instead, so the field is
// still named for a screen reader.
export function TextAreaConfigField({ label, ariaLabel, value, onChange, placeholder, rows = 3, hidden = false }) {
    return (
        <ConfigItem hidden={hidden}>
            <TextField
                className='w-full'
                aria-label={ariaLabel}
                value={value}
                onChange={onChange}
            >
                {label === undefined ? null : <Label>{label}</Label>}
                <TextArea
                    fullWidth
                    rows={rows}
                    placeholder={placeholder}
                />
            </TextField>
        </ConfigItem>
    );
}

// A labelled dropdown. `options` is `[{ id, label }]`; `id` is what lands in the
// config, `label` is what the trigger and the menu show. Ids are compared as
// strings so a numeric option (a TTS rate, say) still matches its stored value,
// and an id the options do not cover still shows itself on the trigger rather
// than going blank. `triggerLabel` overrides the trigger for the cases where it
// says more than the option does -- "Automatic (en-US-AvaNeural)", say.
export function SelectConfigField({
    label,
    value,
    options,
    onChange,
    ariaLabel,
    triggerLabel,
    scrollable = false,
    hidden = false,
}) {
    const selected = options.find((option) => `${option.id}` === `${value}`);

    return (
        <ConfigItem hidden={hidden}>
            <h3 className='my-auto'>{label}</h3>
            <Dropdown>
                <Button variant='outline'>{triggerLabel ?? (selected === undefined ? value : selected.label)}</Button>
                <Dropdown.Popover>
                    <Dropdown.Menu
                        autoFocus='first'
                        aria-label={ariaLabel ?? label}
                        className={scrollable ? 'max-h-[50vh] overflow-y-auto' : undefined}
                        onAction={onChange}
                    >
                        {options.map((option) => (
                            <Dropdown.Item
                                key={option.id}
                                id={option.id}
                            >
                                {option.label}
                            </Dropdown.Item>
                        ))}
                    </Dropdown.Menu>
                </Dropdown.Popover>
            </Dropdown>
        </ConfigItem>
    );
}

// The label sits after the control in the DOM and is pulled back in front of it
// by `flex-row-reverse`, which is what puts the switch on the right where every
// other row keeps its input.
export function SwitchConfigField({ label, value, onChange, hidden = false }) {
    return (
        <ConfigItem hidden={hidden}>
            <Switch
                isSelected={value}
                onChange={onChange}
                className='w-full max-w-full'
            >
                <Switch.Content className='flex w-full flex-row-reverse items-center justify-between'>
                    <Switch.Control>
                        <Switch.Thumb />
                    </Switch.Control>
                    {label}
                </Switch.Content>
            </Switch>
        </ConfigItem>
    );
}

// The row linking out to the service's page in the docs. Opened through the
// shell plugin, since a plain anchor would navigate the settings webview.
export function HelpLink({ url, hidden = false }) {
    const { t } = useTranslation();

    return (
        <ConfigItem hidden={hidden}>
            <h3 className='my-auto'>{t('services.help')}</h3>
            <Button
                onPress={() => {
                    open(url);
                }}
            >
                {t('services.help')}
            </Button>
        </ConfigItem>
    );
}
