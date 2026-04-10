import xmltodict
import json
import logging

logger = logging.getLogger(__name__)

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
