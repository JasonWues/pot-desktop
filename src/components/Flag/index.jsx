import React from 'react';

// One import per flag, on purpose. `flag-icons/css/flag-icons.min.css` names
// every flag it ships, so importing it made the build copy 142 SVGs (3.5MB)
// into dist for the ~27 codes `LanguageFlag` can actually produce -- and some
// single flags in that set are 177KB.
import ae from 'flag-icons/flags/4x3/ae.svg';
import br from 'flag-icons/flags/4x3/br.svg';
import cn from 'flag-icons/flags/4x3/cn.svg';
import de from 'flag-icons/flags/4x3/de.svg';
import es from 'flag-icons/flags/4x3/es.svg';
import fr from 'flag-icons/flags/4x3/fr.svg';
import gb from 'flag-icons/flags/4x3/gb.svg';
import id from 'flag-icons/flags/4x3/id.svg';
import il from 'flag-icons/flags/4x3/il.svg';
import _in from 'flag-icons/flags/4x3/in.svg';
import ir from 'flag-icons/flags/4x3/ir.svg';
import it from 'flag-icons/flags/4x3/it.svg';
import jp from 'flag-icons/flags/4x3/jp.svg';
import kh from 'flag-icons/flags/4x3/kh.svg';
import kr from 'flag-icons/flags/4x3/kr.svg';
import mn from 'flag-icons/flags/4x3/mn.svg';
import ms from 'flag-icons/flags/4x3/ms.svg';
import nl from 'flag-icons/flags/4x3/nl.svg';
import no from 'flag-icons/flags/4x3/no.svg';
import pl from 'flag-icons/flags/4x3/pl.svg';
import pt from 'flag-icons/flags/4x3/pt.svg';
import ru from 'flag-icons/flags/4x3/ru.svg';
import se from 'flag-icons/flags/4x3/se.svg';
import th from 'flag-icons/flags/4x3/th.svg';
import tr from 'flag-icons/flags/4x3/tr.svg';
import ua from 'flag-icons/flags/4x3/ua.svg';
import vn from 'flag-icons/flags/4x3/vn.svg';

// Keys are the values of `LanguageFlag` (src/utils/language.ts).
const flags = {
    ae,
    br,
    cn,
    de,
    es,
    fr,
    gb,
    id,
    il,
    in: _in,
    ir,
    it,
    jp,
    kh,
    kr,
    mn,
    ms,
    nl,
    no,
    pl,
    pt,
    ru,
    se,
    th,
    tr,
    ua,
    vn,
};

// Sized like flag-icons' own `.fi`: 4x3 at the current font size.
export default function Flag(props) {
    const { code } = props;
    return (
        <img
            src={flags[code]}
            alt=''
            aria-hidden='true'
            className='inline-block w-[1.333em] h-[1em] object-contain'
        />
    );
}
