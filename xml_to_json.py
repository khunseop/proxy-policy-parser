import xmltodict
import json

def xml_file_to_json_file(xml_path, json_path):
    try:
        # XML 파일 읽기
        with open(xml_path, 'r', encoding='utf-8') as xml_file:
            xml_content = xml_file.read()
        
        # XML -> dict
        parsed_dict = xmltodict.parse(xml_content)

        # dict -> json 문자열
        json_data = json.dumps(parsed_dict, indent=4, ensure_ascii=False)

        # JSON 파일로 저장
        with open(json_path, 'w', encoding='utf-8') as json_file:
            json_file.write(json_data)

            print(f"변환 완료: '{xml_path}' -> '{json_path}'")
        except Exception as e:
            print(f"오류 발생: {str(e)}")