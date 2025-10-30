import re


_ID18_RE = re.compile(r"^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[0-9Xx]$")
_WEIGHT = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
_CHECK_MAP = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']


def is_valid_china_id18(id_card: str) -> bool:
    if not isinstance(id_card, str):
        return False
    id_card = id_card.strip()
    if not _ID18_RE.match(id_card):
        return False
    digits = [10 if c in ('X', 'x') else int(c) for c in id_card[:-1]]
    s = sum(w * d for w, d in zip(_WEIGHT, digits))
    check = _CHECK_MAP[s % 11]
    return check == id_card[-1].upper()




