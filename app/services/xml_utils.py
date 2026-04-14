import xmltodict
import json
import logging

logger = logging.getLogger(__name__)

def strip_scur(id_str: str) -> str:
    """com.scur. 접두사를 제거하여 화면 표시용 단축 ID를 반환한다.

    원본 ID는 ConditionRaw(JSON)에서 보존되며, 이 함수는 Condition/Actions
    표시 문자열 생성 시에만 사용한다.

    예시:
        com.scur.engine.mwg.URL.Host          → engine.mwg.URL.Host
        com.scur.type.operator.matches        → type.operator.matches
        com.scur.type.list.categorized.url    → type.list.categorized.url
        com.scur.action.block                 → action.block
        com.scur.type.string.1234abcd         → type.string.1234abcd
    """
    if not id_str or not isinstance(id_str, str):
        return id_str or ""
    return id_str[len("com.scur."):] if id_str.startswith("com.scur.") else id_str

def xml_to_dict(xml_content):
    try:
        return xmltodict.parse(xml_content)
    except Exception as e:
        logger.error(f"XML to Dict 변환 실패: {str(e)}")
        raise

def xml_file_to_json_file(xml_path, json_path):
    try:
        with open(xml_path, 'r', encoding='utf-8') as xml_file:
            xml_content = xml_file.read()
        
        parsed_dict = xml_to_dict(xml_content)
        json_data = json.dumps(parsed_dict, indent=4, ensure_ascii=False)

        with open(json_path, 'w', encoding='utf-8') as json_file:
            json_file.write(json_data)
        
        logger.info(f"변환 완료: '{xml_path}' -> '{json_path}'")
    except Exception as e:
        logger.error(f"파일 변환 오류 발생: {str(e)}")
        raise
