import { Button, Label, TextArea, TextField } from '@heroui/react';
import { MdDeleteOutline } from 'react-icons/md';
import React from 'react';

// The conversation an LLM service is primed with. Four services ship this
// editor and all four drew the same rows; what actually differs between them is
// only how one message is spelled, which is what a schema below describes:
//
//   roleAt   which role the message at this index takes -- the sequence is
//            positional, so editing a message and appending one agree without
//            either having to be told the other's rule.
//   getText  pull the editable text out of a message.
//   build    put a role and a text back together into one.

export const CHAT_PROMPT_SCHEMA = {
    roleAt: (index) => (index === 0 ? 'system' : index % 2 !== 0 ? 'user' : 'assistant'),
    getText: (prompt) => prompt.content,
    build: (role, text) => ({ role, content: text }),
};

// No system message: the priming is a user turn the model has already answered.
export const ALTERNATING_PROMPT_SCHEMA = {
    roleAt: (index) => (index % 2 !== 0 ? 'assistant' : 'user'),
    getText: (prompt) => prompt.content,
    build: (role, text) => ({ role, content: text }),
};

// Gemini calls the assistant 'model' and wraps the text in a parts array.
export const GEMINI_PROMPT_SCHEMA = {
    roleAt: (index) => (index % 2 !== 0 ? 'model' : 'user'),
    getText: (prompt) => prompt.parts[0].text,
    build: (role, text) => ({ role, parts: [{ text }] }),
};

export default function PromptListEditor({ promptList, schema, description, addLabel, onChange }) {
    return (
        <>
            <h3 className='my-auto'>Prompt List</h3>
            <p className='text-[10px] text-foreground'>{description}</p>

            <div className='bg-surface-secondary rounded-[10px] p-3'>
                {promptList &&
                    promptList.map((prompt, index) => (
                        <div
                            className='config-item'
                            key={index}
                        >
                            <TextField
                                className='w-full'
                                value={schema.getText(prompt)}
                                onChange={(value) => {
                                    onChange(
                                        promptList.map((p, i) =>
                                            i === index ? schema.build(schema.roleAt(index), value) : p
                                        )
                                    );
                                }}
                            >
                                <Label>{prompt.role}</Label>
                                <TextArea
                                    fullWidth
                                    rows={3}
                                    placeholder={`Input Some ${prompt.role} Prompt`}
                                />
                            </TextField>
                            <Button
                                isIconOnly
                                className='my-auto mx-1'
                                variant='danger-soft'
                                onPress={() => {
                                    onChange(promptList.filter((_, i) => i !== index));
                                }}
                            >
                                <MdDeleteOutline className='text-[18px]' />
                            </Button>
                        </div>
                    ))}
                <Button
                    fullWidth
                    onPress={() => {
                        onChange([...promptList, schema.build(schema.roleAt(promptList.length), '')]);
                    }}
                >
                    {addLabel}
                </Button>
            </div>
            <br />
        </>
    );
}
