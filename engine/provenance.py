"""Offline evidence verification against actual source bytes and JSON pointers.

Runtime schema validation remains usable for editable SQLite datasets. This
stricter check is a release/admin check and never invents owner approval.
"""
import hashlib
import json
import re
import unicodedata
from pathlib import Path, PurePosixPath

from engine.models import MetadataError
from engine.snapshot import ROOT


def pointer_value(raw, pointer):
    if not pointer.startswith('/'):
        raise MetadataError('Source pointer must be absolute JSON pointer')
    value = raw
    try:
        for token in pointer[1:].split('/'):
            token = token.replace('~1', '/').replace('~0', '~')
            value = value[int(token)] if isinstance(value, list) else value[token]
        return value
    except (KeyError, ValueError, IndexError, TypeError) as error:
        raise MetadataError('Source JSON pointer does not resolve') from error


def top_level_object_ranges(content):
    ranges = []
    depth = 0
    start = None
    in_string = False
    escaped = False
    for line_number, line in enumerate(content.decode('utf-8').splitlines(), 1):
        for character in line:
            if in_string:
                if escaped:
                    escaped = False
                elif character == '\\':
                    escaped = True
                elif character == '"':
                    in_string = False
            elif character == '"':
                in_string = True
            elif character in '[{':
                if character == '{' and depth == 1:
                    start = line_number
                depth += 1
            elif character in ']}':
                if character == '}' and depth == 2:
                    ranges.append((start, line_number))
                depth -= 1
    return ranges


def verify_provenance(raw, root=ROOT):
    root = Path(root).resolve()
    sources, bytes_by_path, ranges_by_path = {}, {}, {}
    for name, expected in raw['source_sha256'].items():
        relative = PurePosixPath(name)
        if relative.is_absolute() or '..' in relative.parts or ':' in name or '\\' in name:
            raise MetadataError('Source path must stay within the repository')
        path = (root / name).resolve()
        if not path.is_relative_to(root):
            raise MetadataError('Source path escapes through a symbolic link')
        try:
            content = path.read_bytes()
            sources[name] = json.loads(content)
        except (OSError, ValueError) as error:
            raise MetadataError('Cannot read source evidence') from error
        if hashlib.sha256(content).hexdigest() != expected:
            raise MetadataError(f'Actual source fingerprint mismatch: {name}')
        bytes_by_path[name] = content
        ranges_by_path[name] = top_level_object_ranges(content)
    transformations = []
    for doc in raw['documents']:
        provenance = doc['provenance']
        content = bytes_by_path.get(provenance['source_path'])
        if content is None or provenance['sha256'] != raw['source_sha256'][provenance['source_path']]:
            raise MetadataError('Document source fingerprint differs')
        lines = content.decode('utf-8').splitlines()
        if not 1 <= provenance['line_start'] <= provenance['line_end'] <= len(lines):
            raise MetadataError('Document source range outside actual file')
        for clause in doc['clauses']:
            source = clause['source_ref']
            value = pointer_value(sources[source['path']], source['json_pointer'])
            if not isinstance(value, dict) or value.get('text') != clause['text_source']:
                raise MetadataError('Clause text differs from actual evidence')
            if not provenance['line_start'] <= source['line'] <= provenance['line_end']:
                raise MetadataError('Clause source line outside document')
            if not re.fullmatch(r'\s*"' + re.escape(clause['key']) + r'":\s*\{\s*', lines[source['line'] - 1]):
                raise MetadataError('Clause source line does not identify its key')
            # A pointer to another identical clause must not change document identity.
            pointer_doc = source['json_pointer'].split('/')[1]
            source_index = int(pointer_doc)
            source_doc = sources[source['path']][source_index]
            if source_doc['doc_id'] != doc['policy_id'] or source_doc['version'] != doc['version']:
                raise MetadataError('Clause pointer belongs to another policy/version')
            exact_range = ranges_by_path[source['path']][source_index]
            if exact_range != (provenance['line_start'], provenance['line_end']):
                raise MetadataError('Document source range differs from actual evidence')
            typed = clause['typed_value']
            if typed['kind'] == 'unlimited':
                if value.get('value') != 99 or typed['value'] is not None:
                    raise MetadataError('Unrecognized unlimited transformation')
                transformations.append({'clause_id': clause['clause_id'], 'decision': 'M03', 'owner_confirmed': False})
            elif type(value.get('value')) is not type(typed['value']) or value['value'] != typed['value']:
                raise MetadataError('Typed value differs from actual evidence')
            if bool(value.get('is_floor', False)) != clause['is_floor']:
                raise MetadataError('Floor differs from actual evidence')
            text = ''.join(char for char in unicodedata.normalize('NFD', value['text'].lower()) if not unicodedata.combining(char))
            expected_unit = 'not_applicable'
            if clause['key'] == 'entitlement' and typed['kind'] == 'number':
                expected_unit = 'annual_paid_days'
            elif clause['key'] == 'notice_period':
                expected_unit = 'business_days' if 'ngay lam viec' in text else 'calendar_days' if 'ngay lich' in text else 'unspecified_days'
            if typed['unit'] != expected_unit:
                raise MetadataError('Typed unit differs from actual evidence')
    return {'verified': True, 'sources': len(sources),
            'clauses': sum(len(doc['clauses']) for doc in raw['documents']),
            'mock_transformations': transformations}
