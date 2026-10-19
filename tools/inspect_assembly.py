"""Read CLR metadata/IL without loading or executing the game assembly."""
import argparse
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / '.tools/python'))
import dnfile
from dncil.cil.body.reader import read_method_body_from_bytes

parser = argparse.ArgumentParser()
parser.add_argument('assembly')
parser.add_argument('--type', default='card|creature|battle|ability|talent|tox|localiz')
parser.add_argument('--il', default='^$')
args = parser.parse_args()
pe = dnfile.dnPE(args.assembly)
owners = {}
for typedef in pe.net.mdtables.TypeDef:
    for method in typedef.MethodList:
        owners[id(method.row)] = str(typedef.TypeName)

def token_name(token):
    value = getattr(token, 'value', None)
    if value is None:
        return str(token)
    table = value >> 24
    rid = value & 0xffffff
    if table == 0x70:
        try:
            return repr(pe.net.user_strings.get(rid).value)
        except Exception:
            return str(token)
    rows = {0x01: 'TypeRef', 0x02: 'TypeDef', 0x04: 'Field', 0x06: 'MethodDef',
            0x0a: 'MemberRef', 0x1b: 'TypeSpec', 0x2b: 'MethodSpec'}
    try:
        row = getattr(pe.net.mdtables, rows[table]).rows[rid - 1]
        return owners.get(id(row), '') + '::' + str(getattr(row, 'Name', getattr(row, 'TypeName', token)))
    except Exception:
        return str(token)

for typedef in pe.net.mdtables.TypeDef:
    name = str(typedef.TypeName)
    if not re.search(args.type, name, re.I):
        continue
    print('\nTYPE', str(typedef.TypeNamespace) + '.' + name)
    for field in typedef.FieldList:
        print('  FIELD', field.row.Name, field.row.Signature.value.hex())
    for method in typedef.MethodList:
        row = method.row
        print('  METHOD', row.Name, row.Signature.value.hex())
        if row.Rva and re.search(args.il, name + '.' + str(row.Name)):
            try:
                body = read_method_body_from_bytes(pe.get_data(row.Rva, 200000))
                for instruction in body.instructions:
                    print('   ', instruction.offset, instruction.opcode.name, token_name(instruction.operand))
            except Exception as exc:
                print('    IL ERROR', str(exc))
