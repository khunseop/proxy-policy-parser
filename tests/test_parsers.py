import pytest
import os
from app.core.parsers.policy_parser import PolicyParser

def test_basic_xml_parsing():
    # 더미 XML (단일 RuleGroup과 단일 Rule 포함)
    dummy_xml = """
    <libraryContent>
        <ruleGroup name="Top Group" id="1" enabled="true">
            <description>Test Group Description</description>
            <rules>
                <rule name="Test Rule" id="101" enabled="true">
                    <description>Test Rule Description</description>
                    <condition>
                        <expressions>
                            <conditionExpression operatorId="equals">
                                <propertyInstance propertyId="URL.Host"/>
                                <parameter>
                                    <value>
                                        <stringValue value="example.com"/>
                                    </value>
                                </parameter>
                            </conditionExpression>
                        </expressions>
                    </condition>
                </rule>
            </rules>
        </ruleGroup>
    </libraryContent>
    """
    
    parser = PolicyParser(dummy_xml, from_xml=True)
    rulegroups, rules = parser.parse()
    
    assert len(rulegroups) == 1
    assert rulegroups[0]["name"] == "Top Group"
    assert rulegroups[0]["type"] == "group"
    
    assert len(rules) == 1
    assert rules[0]["name"] == "Test Rule"
    assert rules[0]["type"] == "rule"
    assert rules[0]["condition_property"] == "URL.Host"
    assert rules[0]["condition_operator"] == "equals"
    # condition_values는 리스트이거나 단일 값일 수 있음 (현재 구현 확인 필요)

def test_empty_xml_parsing():
    empty_xml = "<libraryContent><ruleGroup/></libraryContent>"
    parser = PolicyParser(empty_xml, from_xml=True)
    rulegroups, rules = parser.parse()
    
    # 데이터가 없을 때의 동작 검증
    assert isinstance(rulegroups, list)
    assert isinstance(rules, list)
