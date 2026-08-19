import React from 'react';

/*
  The shape every settings page in this window is built from: named groups of
  rows, no cards. The gutter says what a group is for once, so a row underneath
  only has to explain itself -- which is what pays for dropping the cards the
  pages used to stack.

  The classes (`.flat-section`, `.flat-row`) live in src/styles/flat.css next to
  the rest of this vocabulary, so the Recognize window and the Service page draw
  from the same set.
*/
export function Section({ name, note, children }) {
    return (
        <section className='flat-section'>
            <div className='flat-section__gutter'>
                <div className='flat-section__name'>{name}</div>
                {note && <div className='flat-section__note'>{note}</div>}
            </div>
            <div className='flat-section__rows'>{children}</div>
        </section>
    );
}

/*
  One setting: label and its line of help on the left, the control hard right.

  `className` is forwarded rather than replaced because `hidden` is still how
  the OS-specific rows and the ones that depend on another setting drop out.
*/
export function Row({ label, desc, className = '', children }) {
    return (
        <div className={`flat-row ${className}`}>
            <div className='flat-row__main'>
                <div className='flat-row__label'>{label}</div>
                {desc && <div className='flat-row__desc'>{desc}</div>}
            </div>
            <div className='flat-row__control'>{children}</div>
        </div>
    );
}
