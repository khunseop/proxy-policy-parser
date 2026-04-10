import json
import sys
import pandas as pd
from rich.console import Console
from rich.tree import Tree
from rich.syntax import Syntax
from rich.table import Table
from pathlib import Path

console = Console()

def build_tree(data, tree):
    """JSON 데이터를 Rich Tree 구조로 재귀적으로 구축"""
    if isinstance(data, dict):
        for key, value in data.items():
            node = tree.add(f"[bold magenta]{key}[/bold magenta]")
            build_tree(value, node)
    elif isinstance(data, list):
        for i, item in enumerate(data):
            node = tree.add(f"[cyan]Index {i}[/cyan]")
            build_tree(item, node)
    else:
        tree.add(f"[green]{data}[/green]")

def inspect_json(file_path: str):
    path = Path(file_path)
    if not path.exists():
        console.print(f"[bold red]파일을 찾을 수 없습니다:[/bold red] {file_path}")
        return

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        console.print(f"[bold red]JSON 로드 실패:[/bold red] {str(e)}")
        return

    # 1. 트리 시각화
    console.rule(f"[bold blue]JSON Structure Tree: {path.name}[/bold blue]")
    tree = Tree(f"[bold yellow]{path.name}[/bold yellow]")
    build_tree(data, tree)
    console.print(tree)

    # 2. 데이터 평탄화 (Pandas json_normalize 활용)
    console.rule("[bold blue]Flattened Key-Value Pairs (Schema Inspection)[/bold blue]")
    try:
        # 매우 깊은 구조도 점(.)으로 구분된 평면 구조로 변환
        df_flat = pd.json_normalize(data, sep='.')
        
        # 컬럼 이름(Path)들만 추출하여 테이블 생성
        table = Table(title="Flattened Paths and Sample Values")
        table.add_column("Path (Key)", style="cyan", no_wrap=True)
        table.add_column("Sample Value", style="green")

        for col in df_flat.columns:
            # 첫 번째 행의 샘플 값을 보여줌
            sample_value = str(df_flat[col].iloc[0]) if not df_flat.empty else "N/A"
            # 값이 너무 길면 자름
            if len(sample_value) > 100:
                sample_value = sample_value[:97] + "..."
            table.add_row(col, sample_value)
        
        console.print(table)
        console.print(f"\n[bold yellow]Total attributes found:[/bold yellow] {len(df_flat.columns)}")

    except Exception as e:
        console.print(f"[yellow]평탄화 중 일부 오류가 발생했습니다(데이터 형식 문제):[/yellow] {str(e)}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        console.print("[bold red]사용법:[/bold red] python inspect_json.py <file_path.json>")
    else:
        inspect_json(sys.argv[1])
