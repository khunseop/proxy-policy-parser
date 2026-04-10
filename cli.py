import typer
import json
import asyncio
import pandas as pd
from pathlib import Path
from typing import Optional
from app.services.parser_service import ParserService
from rich.console import Console
from rich.table import Table

app = typer.Typer(help="Skyhigh Proxy Policy Parser CLI")
console = Console()
service = ParserService()

@app.command()
def list_rulesets():
    """Skyhigh 장비에서 Rule Set 목록을 조회합니다."""
    async def run():
        try:
            with console.status("[bold green]Rule Set 목록 조회 중..."):
                rulesets = await service.list_rulesets()
            
            table = Table(title="Skyhigh Rule Sets")
            table.add_column("ID", style="cyan")
            table.add_column("Title", style="magenta")
            table.add_column("Enabled", style="green")
            table.add_column("Child Count", justify="right")

            for rs in rulesets:
                table.add_row(
                    rs.get("id"),
                    rs.get("title"),
                    rs.get("enabled"),
                    rs.get("no_of_child")
                )
            
            console.print(table)
        except Exception as e:
            console.print(f"[bold red]오류 발생:[/bold red] {str(e)}")

    asyncio.run(run())

@app.command()
def parse_local(
    file_path: Path = typer.Argument(..., help="파싱할 XML 파일 경로"),
    output_excel: Optional[str] = typer.Option(None, "--excel", "-e", help="결과를 저장할 엑셀 파일 이름"),
    output_json: Optional[str] = typer.Option(None, "--json", "-j", help="결과를 저장할 JSON 파일 이름")
):
    """로컬 XML 파일을 파싱합니다."""
    async def run():
        if not file_path.exists():
            console.print(f"[bold red]파일이 존재하지 않습니다:[/bold red] {file_path}")
            return

        try:
            with open(file_path, "rb") as f:
                content = f.read()
            
            with console.status(f"[bold green]{file_path.name} 파싱 중..."):
                result = await service.parse_from_file(content)
            
            console.print(f"[bold green]파싱 완료![/bold green]")
            console.print(f"RuleGroups: {result['summary']['rulegroups_count']}, Rules: {result['summary']['rules_count']}")

            if output_json:
                with open(output_json, "w", encoding="utf-8") as f:
                    json.dump(result, f, indent=4, ensure_ascii=False)
                console.print(f"JSON 결과 저장됨: [cyan]{output_json}[/cyan]")

            if output_excel:
                service.export_to_excel(result, output_excel)
                console.print(f"Excel 결과 저장됨: [cyan]{output_excel}[/cyan]")
            
            if not output_json and not output_excel:
                # 기본적으로 JSON 출력 (요약)
                console.print(result['summary'])

        except Exception as e:
            console.print(f"[bold red]파싱 오류:[/bold red] {str(e)}")

    asyncio.run(run())

@app.command()
def fetch_and_parse(
    ruleset_id: str = typer.Argument(..., help="가져올 Rule Set ID"),
    output_excel: Optional[str] = typer.Option(None, "--excel", "-e", help="결과를 저장할 엑셀 파일 이름")
):
    """장비에서 Rule Set을 직접 가져와서 파싱합니다."""
    async def run():
        try:
            with console.status(f"[bold green]Rule Set {ruleset_id} 가져오는 중..."):
                result = await service.parse_from_api(ruleset_id)
            
            console.print(f"[bold green]가져오기 및 파싱 완료![/bold green]")
            
            if output_excel:
                service.export_to_excel(result, output_excel)
                console.print(f"Excel 결과 저장됨: [cyan]{output_excel}[/cyan]")
            else:
                console.print(result['summary'])
                
        except Exception as e:
            console.print(f"[bold red]오류 발생:[/bold red] {str(e)}")

    asyncio.run(run())

if __name__ == "__main__":
    app()
