"""Download a bounded public Sparkov CSV sample; never execute remote code."""
import argparse
import csv
import hashlib
import io
import json
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
URL = 'https://huggingface.co/SquareBracket/fraud_detection/resolve/main/fraudTrain.csv?download=true'

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--rows',type=int,default=30000)
    args=parser.parse_args()
    if not 1000<=args.rows<=100000:
        parser.error('Use 1,000–100,000 rows for this prototype')
    target=ROOT/'data/raw/sparkov_sample.csv'
    target.parent.mkdir(parents=True,exist_ok=True)
    req=urllib.request.Request(URL,headers={'User-Agent':'FraudGuard-public-dataset/0.2'})
    with urllib.request.urlopen(req,timeout=60) as response:
        reader=csv.DictReader(io.TextIOWrapper(response,encoding='utf-8-sig'))
        required={'trans_num','cc_num','merchant','amt','trans_date_trans_time','is_fraud'}
        if not required.issubset(reader.fieldnames or []):
            raise ValueError('Downloaded content is not the expected Sparkov CSV schema')
        with target.with_suffix('.partial').open('w',newline='') as output:
            writer=csv.DictWriter(output,fieldnames=reader.fieldnames)
            writer.writeheader()
            count=0
            for row in reader:
                writer.writerow(row)
                count+=1
                if count>=args.rows:
                    break
    target.with_suffix('.partial').replace(target)
    manifest={'name':'Sparkov public synthetic transaction sample','source_url':URL,
      'original_dataset':'https://www.kaggle.com/datasets/kartik2112/fraud-detection',
      'generator':'https://github.com/namebrandon/Sparkov_Data_Generation',
      'mirror':'https://huggingface.co/SquareBracket/fraud_detection',
      'rows':count,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
      'downloaded_at':datetime.now(UTC).isoformat(),'synthetic':True,
      'selection':'First N CSV rows, subsequently sorted by event time for training',
      'limitations':'Public mirror sample; not real bank data and not a full benchmark. No device/IP fields. Home/merchant coordinates are not customer travel evidence.'}
    (ROOT/'data/dataset_manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps({'downloaded_rows':count,'file':str(target),'sha256':manifest['sha256']}))

if __name__=='__main__':
    main()
