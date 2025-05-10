import { chromium, type Page } from 'playwright-core';
import * as fs from 'fs';
import * as path from 'path';

// ダミーモードフラグ (実際の検索をスキップし、ダミーデータを返す)
let DUMMY_MODE = false;

// コマンドライン引数を解析
const args = process.argv.slice(2);
let inputFilePath = '';
let outputFilePath = path.join(process.cwd(), 'output', 'jasrac-results');

// 引数解析
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--input' && i + 1 < args.length) {
    inputFilePath = args[i + 1];
    i++;
  } else if (args[i] === '--output' && i + 1 < args.length) {
    outputFilePath = args[i + 1];
    i++;
  } else if (args[i] === '--dummy') {
    // ダミーモードフラグがあれば設定
    DUMMY_MODE = true;
  }
}

interface SongInfo {
  title: string;
  artist?: string;
  composer?: string;
  lyricist?: string;
}

interface JasracInfo {
  workCode: string;
  title: string;
  lyricist: string;
  composer: string;
  artist: string;
  // 追加情報
  arranger: string;         // 編曲者
  duration: string;         // 演奏時間
  workType: string;         // 作品種別
  nationality: string;      // 国籍区分
  creationDate: string;     // 作成年月日
  rightsInfo: RightInfo[];  // 権利情報（複数の著作権者情報）
  usageCategory: string;    // 利用分野
  publisher: string;        // 出版社情報
  sourceType: string;       // 出典情報
  
  // 管理状況（利用分野）情報の追加
  usagePermissions: UsagePermission;  // 利用許可情報
  
  rawHtml: string;          // デバッグ用に生のHTML
  alternatives?: JasracInfo[]; // 他の候補
}

// 権利者情報
interface RightInfo {
  name: string;             // 権利者名
  role: string;             // 役割（作詞、作曲など）
  shares: string;           // シェア率
  society: string;          // 所属団体
}

// 利用分野の許可情報
interface UsagePermission {
  // 演奏カテゴリ
  performance: {
    concert: boolean;         // 演奏会等
    bgm: boolean;             // 上映/BGM
    karaoke: boolean;         // 社交場/カラオケ
  };
  // 複製カテゴリ
  reproduction: {
    recording: boolean;       // 録音
    publication: boolean;     // 出版
    rental: boolean;          // 貸与
    video: boolean;           // ビデオ
    movie: boolean;           // 映画
  };
  // 公衆送信カテゴリ
  transmission: {
    broadcast: boolean;       // 放送
    distribution: boolean;    // 配信
    karaoke_comm: boolean;    // 通カラ
  };
  // 広告カテゴリ
  advertisement: {
    cm: boolean;              // 広告/CM送録
    movie_ad: boolean;        // 広告/映録
    recording_ad: boolean;    // 広告/録音
    video_ad: boolean;        // 広告/ビデオ
    publication_ad: boolean;  // 広告/出版
  };
  // ゲームカテゴリ
  game: {
    recording_game: boolean;  // ゲーム/録音
    video_game: boolean;      // ゲーム/ビデオ
  };
  // 管理状況の詳細テキスト
  managementDetails: Record<string, string>;
}

// デバッグ用の関数：ページの状態をログに出力し、スクリーンショットを保存
async function debugPageState(page: Page, errorInfo: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const debugDir = path.join(process.cwd(), 'debug');
  
  // デバッグディレクトリがなければ作成
  if (!fs.existsSync(debugDir)) {
    fs.mkdirSync(debugDir, { recursive: true });
  }
  
  // スクリーンショットを保存
  try {
    const screenshotPath = path.join(debugDir, `error-${timestamp}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`スクリーンショットを保存しました: ${screenshotPath}`);
  } catch (e) {
    console.error('スクリーンショットの保存に失敗しました:', e);
  }
  
  // ページのHTMLを保存
  try {
    const htmlPath = path.join(debugDir, `page-${timestamp}.html`);
    const html = await page.content();
    fs.writeFileSync(htmlPath, html);
    console.log(`ページのHTMLを保存しました: ${htmlPath}`);
  } catch (e) {
    console.error('HTMLの保存に失敗しました:', e);
  }
  
  // URLとエラー情報を出力
  console.error(`現在のURL: ${page.url()}`);
  console.error(`エラー情報: ${errorInfo}`);
}

// 曲情報を取得する関数
async function getSongList(): Promise<SongInfo[]> {
  try {
    // 入力ファイルが指定されている場合はそこから読み込む
    if (inputFilePath && fs.existsSync(inputFilePath)) {
      console.log(`入力ファイルからデータを読み込みます: ${inputFilePath}`);
      const data = fs.readFileSync(inputFilePath, 'utf8');
      return JSON.parse(data);
    }
    
    // デフォルトではダミーデータを返す
    console.log('入力ファイルが指定されていないため、ダミーデータを使用します');
    return [
      { title: 'Butter-Fly', composer: '千綿偉功', lyricist: '和田光司' },
      { title: '時代', composer: '中島みゆき', lyricist: '中島みゆき' },
    ];
  } catch (error) {
    console.error('曲情報の取得に失敗しました:', error);
    throw error;
  }
}

async function searchJasrac(page: Page, song: SongInfo): Promise<JasracInfo | null> {
  console.log(`「${song.title}」の情報をJASRACで検索中...`);
  
  try {
    // JASRACのウェブサイトにアクセス（既にログインしていない場合）
    const currentUrl = page.url();
    if (!currentUrl.includes('jasrac.or.jp')) {
      await page.goto('https://www2.jasrac.or.jp/eJwid/main?trxID=F00100');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(5000); // ページの読み込み待機を長めに設定
    }

    // 段階的な検索を実行
    return await performSearchWithFallback(page, song);
  } catch (error) {
    await debugPageState(page, `検索処理中にエラーが発生: ${error}`);
    console.error(`「${song.title}」の検索中にエラーが発生しました:`, error);
    return null;
  }
}

// 段階的な検索を実行する関数
async function performSearchWithFallback(page: Page, song: SongInfo): Promise<JasracInfo | null> {
  // 利用可能な情報に基づいて適用する検索戦略を選択
  const availableStrategies: (() => Promise<JasracInfo | null>)[] = [];
  
  // タイトルは常に必須
  if (!song.title) {
    console.log('曲のタイトルが指定されていないため、検索できません');
    return null;
  }
  
  // 戦略1: タイトル + 作詞者 + 作曲者 (すべての情報がある場合のみ)
  if (song.lyricist && song.composer) {
    availableStrategies.push(async () => {
      console.log(`戦略: タイトル(${song.title}) + 作詞者(${song.lyricist}) + 作曲者(${song.composer})${song.artist ? ' + アーティスト(' + song.artist + ')' : ''}で検索`);
      await clearAndFillSearchForm(page);
      await page.fill('input[name="IN_WORKS_TITLE_NAME1"]', song.title);
      
      // TypeScript型エラー回避のため、lyricistとcomposerが存在することを再確認
      if (song.lyricist) {
        await page.fill('input[name="IN_KEN_NAME1"]', song.lyricist);
        // 作詞者として検索
        await page.evaluate(() => {
          const select = document.querySelector('input[name="IN_KEN_NAME_JOB1"]') as HTMLInputElement;
          if (select) select.value = '1'; // 1=作詞者
        });
      }
      
      if (song.composer) {
        await page.fill('input[name="IN_KEN_NAME2"]', song.composer);
        // 作曲者として検索
        await page.evaluate(() => {
          const select = document.querySelector('input[name="IN_KEN_NAME_JOB2"]') as HTMLInputElement;
          if (select) select.value = '2'; // 2=作曲者
        });
      }
      
      if (song.artist) {
        await page.fill('input[name="IN_ARTIST_NAME1"]', song.artist);
      }
      
      return await executeSearch(page, song);
    });
  }
  
  // 戦略2: タイトル + 作曲者 (作曲者情報がある場合)
  if (song.composer) {
    availableStrategies.push(async () => {
      console.log(`戦略: タイトル(${song.title}) + 作曲者(${song.composer})で検索`);
      await clearAndFillSearchForm(page);
      await page.fill('input[name="IN_WORKS_TITLE_NAME1"]', song.title);
      
      // TypeScript型エラー回避のため、composerが存在することを再確認
      if (song.composer) {
        await page.fill('input[name="IN_KEN_NAME1"]', song.composer);
        // 作曲者として検索
        await page.evaluate(() => {
          const select = document.querySelector('input[name="IN_KEN_NAME_JOB1"]') as HTMLInputElement;
          if (select) select.value = '2'; // 2=作曲者
        });
      }
      
      return await executeSearch(page, song);
    });
  }
  
  // 戦略3: タイトル + 作詞者 (作詞者情報がある場合)
  if (song.lyricist) {
    availableStrategies.push(async () => {
      console.log(`戦略: タイトル(${song.title}) + 作詞者(${song.lyricist})で検索`);
      await clearAndFillSearchForm(page);
      await page.fill('input[name="IN_WORKS_TITLE_NAME1"]', song.title);
      
      // TypeScript型エラー回避のため、lyricistが存在することを再確認
      if (song.lyricist) {
        await page.fill('input[name="IN_KEN_NAME1"]', song.lyricist);
        // 作詞者として検索
        await page.evaluate(() => {
          const select = document.querySelector('input[name="IN_KEN_NAME_JOB1"]') as HTMLInputElement;
          if (select) select.value = '1'; // 1=作詞者
        });
      }
      
      return await executeSearch(page, song);
    });
  }
  
  // 戦略4: タイトル + アーティスト (アーティスト情報がある場合)
  if (song.artist) {
    availableStrategies.push(async () => {
      console.log(`戦略: タイトル(${song.title}) + アーティスト(${song.artist})で検索`);
      await clearAndFillSearchForm(page);
      await page.fill('input[name="IN_WORKS_TITLE_NAME1"]', song.title);
      
      // TypeScript型エラー回避のため、artistが存在することを再確認
      if (song.artist) {
        await page.fill('input[name="IN_ARTIST_NAME1"]', song.artist);
      }
      
      return await executeSearch(page, song);
    });
  }
  
  // 戦略5: タイトルのみ (常に最後の選択肢として追加)
  availableStrategies.push(async () => {
    console.log(`戦略: タイトル(${song.title})のみで検索`);
    await clearAndFillSearchForm(page);
    await page.fill('input[name="IN_WORKS_TITLE_NAME1"]', song.title);
    
    return await executeSearch(page, song);
  });
  
  console.log(`「${song.title}」の検索に使用可能な戦略: ${availableStrategies.length}個`);
  
  // 各戦略を順番に試す
  for (let i = 0; i < availableStrategies.length; i++) {
    const result = await availableStrategies[i]();
    if (result) {
      console.log(`戦略${i+1}で検索結果が見つかりました`);
      return result;
    }
    console.log(`戦略${i+1}では検索結果が見つかりませんでした、次の戦略を試します`);
  }
  
  console.log(`全ての検索戦略を試しましたが、「${song.title}」の情報は見つかりませんでした`);
  return null;
}

// 検索フォームをクリアして検索準備をする関数
async function clearAndFillSearchForm(page: Page) {
  // クリアボタンを押して前回の検索条件をクリア
  try {
    await page.click('button.btn.searchForm.clear[type="button"]');
    await page.waitForTimeout(1000);
  } catch (e) {
    console.log('クリアボタンが見つからないか、既にクリアされています');
  }
}

// 検索を実行して結果を処理する関数
async function executeSearch(page: Page, song: SongInfo): Promise<JasracInfo | null> {
  // 検索ボタンをクリック
  const searchButton = await page.$('button[name="CMD_SEARCH"][type="submit"]');
  if (!searchButton) {
    await debugPageState(page, '検索ボタンが見つかりません');
    throw new Error('検索ボタンが見つかりません');
  }
  
  await searchButton.click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000); // 検索結果の読み込み待機
  
  // 検索結果があるか確認
  const noResultElement = await page.$('div.search-noresult');
  if (noResultElement) {
    console.log(`「${song.title}」の情報は見つかりませんでした`);
    return null;
  }
  
  // 検索結果ページの状態を確認
  console.log('検索結果ページを解析中...');
  const resultTable = await page.$('table.search-result');
  if (!resultTable) {
    await debugPageState(page, '検索結果テーブルが見つかりません');
    throw new Error('検索結果テーブルが見つかりません');
  }
  
  // 検索結果から詳細リンクを探す
  console.log('検索結果から詳細リンクを探しています...');
  
  // テーブル内のすべてのリンクとその行の情報を取得
  const rows = await page.$$('table.search-result tbody tr:not(:first-child)'); // ヘッダー行をスキップ
  console.log(`検索結果: ${rows.length}行`);

  console.log('検索結果の行のHTML:', await rows.map(async (row) => await row.innerHTML()));
  
  if (rows.length === 0) {
    await debugPageState(page, '検索結果の行が見つかりません');
    console.log(`「${song.title}」の詳細リンクが見つかりませんでした`);
    return null;
  }

  // スコア配列を作成
  const scoredRows: { index: number; score: number }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const cells = await row.$$('td');
      if (cells.length < 3) continue;
      const titleCell = await cells[2].textContent() || '';
      const authorCell = cells.length > 3 ? await cells[3].textContent() || '' : '';
      
      // タイトルを正規化（全角を半角に、大文字小文字を無視）
      const normalizedTitle = normalizeText(titleCell);
      const normalizedSongTitle = normalizeText(song.title);
      
      // 作詞者・作曲者も正規化
      const normalizedAuthor = normalizeText(authorCell);
      const normalizedLyricist = song.lyricist ? normalizeText(song.lyricist) : '';
      const normalizedComposer = song.composer ? normalizeText(song.composer) : '';
      const normalizedArtist = song.artist ? normalizeText(song.artist) : '';
      
      let score = 0;
      
      // 正規化したテキストで比較
      if (normalizedTitle.includes(normalizedSongTitle)) {
        score += 3;
        console.log(`  タイトル一致: ${titleCell} ⊃ ${song.title}`);
      }
      
      if (normalizedLyricist && normalizedAuthor.includes(normalizedLyricist)) {
        score += 2;
        console.log(`  作詞者一致: ${authorCell} ⊃ ${song.lyricist}`);
      }
      
      if (normalizedComposer && normalizedAuthor.includes(normalizedComposer)) {
        score += 2;
        console.log(`  作曲者一致: ${authorCell} ⊃ ${song.composer}`);
      }
      
      if (normalizedArtist && normalizedAuthor.includes(normalizedArtist)) {
        score += 1;
        console.log(`  アーティスト一致: ${authorCell} ⊃ ${song.artist}`);
      }
      
      scoredRows.push({ index: i, score });
      console.log(`行 ${i+1} のスコア: ${score} (タイトル: ${titleCell.substring(0, 30)}...)`);
    } catch (error) {
      console.error(`行 ${i+1} の解析中にエラーが発生:`, error);
    }
  }
  // スコア順にソートし、上位3件のindexを取得
  scoredRows.sort((a, b) => b.score - a.score);
  const topIndexes = scoredRows.slice(0, 3).map(r => r.index);

  // 上位候補の詳細情報を取得
  const candidates: JasracInfo[] = [];
  for (const idx of topIndexes) {
    const row = rows[idx];
    // 詳細リンクを取得
    const rowLinks = await row.$$('a');
    let info: JasracInfo | null = null;
    if (rowLinks.length > 0) {
      const [newPage] = await Promise.all([
        page.context().waitForEvent('page'),
        rowLinks[0].click()
      ]);
      await newPage.waitForLoadState('domcontentloaded');
      await newPage.waitForTimeout(2000);
      info = await processDetailPage(newPage, song);
    } else {
      const cells = await row.$$('td');
      const codeCell = cells.length > 1 ? cells[1] : null;
      if (codeCell) {
        const codeLinks = await codeCell.$$('a');
        if (codeLinks.length > 0) {
          const [newPage] = await Promise.all([
            page.context().waitForEvent('page'),
            codeLinks[0].click()
          ]);
          await newPage.waitForLoadState('domcontentloaded');
          await newPage.waitForTimeout(2000);
          info = await processDetailPage(newPage, song);
        }
      }
    }
    if (info) candidates.push(info);
  }

  if (candidates.length === 0) return null;

  // 1位をメイン、2位・3位をalternativesに
  const main = candidates[0];
  if (main && candidates.length > 1) {
    // 2位以降の候補をalternativesに追加
    main.alternatives = candidates.slice(1).filter(alt => {
      // 作品コードが異なる候補のみを追加
      return alt.workCode !== main.workCode;
    });
    
    console.log(`メイン候補: ${main.workCode} (${main.title})`);
    console.log(`代替候補: ${main.alternatives.length}件`);
  } else {
    // 候補が1つだけの場合は空の配列を設定
    main.alternatives = [];
  }
  
  return main;
}

// テキスト正規化関数
function normalizeText(text: string): string {
  // 全角→半角変換（カタカナ以外）
  let normalized = text.replace(/[！-～]/g, function(s) {
    return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
  });
  
  // 空白除去
  normalized = normalized.replace(/\s+/g, '');
  
  // 小文字化
  normalized = normalized.toLowerCase();
  
  return normalized;
}

// HTMLの空白を最小化する関数
function minimizeHtml(html: string): string {
  // 連続する空白を1つに置換
  let minimized = html.replace(/\s+/g, ' ');
  // 不要な空白を削除
  minimized = minimized.replace(/> </g, '><');
  minimized = minimized.replace(/\s+</g, '<');
  minimized = minimized.replace(/>\s+/g, '>');
  
  return minimized;
}

// 詳細ページから情報を抽出する関数
async function processDetailPage(newPage: Page, song: SongInfo): Promise<JasracInfo | null> {
  try {
    // 詳細ページのテーブルが存在するか確認
    const detailTableExists = await newPage.$('table.detail');
    if (!detailTableExists) {
      await debugPageState(newPage, '詳細ページのテーブルが見つかりません');
      throw new Error('詳細ページのテーブルが見つかりません');
    }
    
    // 詳細ページから情報を取得
    console.log('詳細情報を抽出中...');
    
    // HTML全体をデバッグ用に取得し、空白を最小化
    const pageHTML = minimizeHtml(await newPage.content());
    
    try {
      // 作品コード
      const workCode = await newPage.$eval('div.baseinfo--code div.detail_iPhone_link > strong', 
        (el: Element) => el.textContent?.trim() || '');
      console.log(`作品コード: ${workCode}`);
      
      // 作品タイトル
      const title = await newPage.$eval('div.baseinfo--name', 
        (el: Element) => el.textContent?.trim() || '');
      console.log(`作品タイトル: ${title}`);
      
      // 作詞者と作曲者の情報取得は詳細に合わせて調整
      let lyricist = '';
      let composer = '';
      let arranger = '';
      let duration = '';
      let workType = '';
      let nationality = '';
      let creationDate = '';
      let usageCategory = '';
      let publisher = '';
      let sourceType = '';  // 出典情報を追加
      
      // 追加情報の取得
      try {
        // 演奏時間の取得
        const durationElement = await newPage.$('div.baseinfo--time');
        if (durationElement) {
          duration = await durationElement.textContent() || '';
          duration = duration.trim();
          console.log(`演奏時間: ${duration}`);
        }
        
        // baseinfo--status から内外区分と出典情報を取得
        const statusDls = await newPage.$$('div.baseinfo--status > dl');
        for (const dl of statusDls) {
          const label = await dl.$eval('dt', (el: Element) => el.textContent?.trim() || '');
          const value = await dl.$eval('dd', (el: Element) => el.textContent?.trim() || '');
          
          if (label.includes('内外')) {
            nationality = value; // 「内国作品」または「外国作品」
            console.log(`内外区分: ${nationality}`);
          } else if (label.includes('出典')) {
            sourceType = value; // 例: 「PO(出版者作品届)」
            console.log(`出典: ${sourceType}`);
          }
        }
        
        // 作品種別などの他の情報を取得
        const infoRows = await newPage.$$('div.baseinfo dl.baseinfo--list > div');
        for (const row of infoRows) {
          const label = await row.$eval('dt', (el: Element) => el.textContent?.trim() || '');
          const value = await row.$eval('dd', (el: Element) => el.textContent?.trim() || '');
          
          if (label.includes('作品種別')) {
            workType = value;
            console.log(`作品種別: ${workType}`);
          } else if (label.includes('作成年月日')) {
            creationDate = value;
            console.log(`作成年月日: ${creationDate}`);
          } else if (label.includes('分野')) {
            usageCategory = value;
            console.log(`利用分野: ${usageCategory}`);
          } else if (label.includes('出版社')) {
            publisher = value;
            console.log(`出版社: ${publisher}`);
          }
        }
      } catch (error) {
        console.log('追加情報の取得中にエラーが発生しました:', error);
      }
      
      // 権利者情報の取得
      const rightsInfo: RightInfo[] = [];
      
      // HTML全体から著作者テーブルを確実に取得する別のアプローチ
      console.log('著作者情報のテーブルを探索中...');
      
      // まず、著作者テーブルが存在するか確認
      const tableExists = await newPage.$('table.detail');
      if (tableExists) {
        // テーブル内の全ての行を取得（より堅牢なセレクタを使用）
        const rows = await newPage.$$('table.detail tr');
        console.log(`テーブル内の行数: ${rows.length}`);
        
        // テーブルの構造を確認するため、各行のHTMLをログ出力
        for (let i = 0; i < Math.min(rows.length, 3); i++) {
          const rowHtml = await newPage.evaluate(el => el.outerHTML, rows[i]);
          console.log(`行 ${i+1} のHTML: ${rowHtml}`);
        }
        
        // ヘッダー行をスキップして各行を処理
        for (let i = 2; i < rows.length; i++) {
          try {
            // 行内のすべてのセルを取得
            const cells = await rows[i].$$('td');
            console.log(`行 ${i+1} のセル数: ${cells.length}`);
            
            if (cells.length >= 3) {
              // セルの内容を取得
              const name = await cells[1].textContent() || '';
              const role = await cells[2].textContent() || '';
              
              let shares = '';
              let society = '';
              
              if (cells.length >= 4) {
                shares = await cells[3].textContent() || '';
              }
              
              if (cells.length >= 5) {
                society = await cells[4].textContent() || '';
              }
              
              // 空白を取り除く
              const nameClean = name.trim();
              const roleClean = role.trim();
              const sharesClean = shares.trim();
              const societyClean = society.trim();
              
              console.log(`権利者情報: ${nameClean} (${roleClean})`);
              
              // 権利者情報を配列に追加
              rightsInfo.push({
                name: nameClean,
                role: roleClean,
                shares: sharesClean,
                society: societyClean
              });
              
              // 作詞者・作曲者・編曲者の情報を設定
              if (roleClean.includes('作詞') && !lyricist) {
                lyricist = nameClean;
                console.log(`作詞者: ${lyricist}`);
              } else if (roleClean.includes('作曲') && !composer) {
                composer = nameClean;
                console.log(`作曲者: ${composer}`);
              } else if (roleClean.includes('編曲') && !arranger) {
                arranger = nameClean;
                console.log(`編曲者: ${arranger}`);
              } else if (roleClean.includes('出版') && !publisher) {
                publisher = nameClean;
                console.log(`出版社: ${publisher}`);
              }
            }
          } catch (error) {
            console.log(`行 ${i+1} の処理中にエラーが発生:`, error);
          }
        }
      } else {
        console.log('著作者情報のテーブルが見つかりませんでした');
      }
      
      // 管理状況（利用分野）情報を取得
      const usagePermissions = await extractUsagePermissions(newPage);
      console.log('管理状況（利用分野）情報を取得しました');
      
      const artist = song.artist || '';
      
      console.log(`「${title}」の情報を取得しました: 作品コード=${workCode}`);
      
      // 詳細ページを閉じる
      await newPage.close();
      
      return {
        workCode,
        title,
        lyricist,
        composer,
        artist,
        arranger,
        duration,
        workType,
        nationality,
        creationDate,
        rightsInfo,
        usageCategory,
        publisher,
        sourceType,     // 出典情報を追加
        usagePermissions,
        rawHtml: pageHTML,  // ここで空白を最小化したHTMLを設定
        alternatives: []
      };
    } catch (error) {
      console.error('詳細情報の抽出中にエラーが発生しました:', error);
      await debugPageState(newPage, 'detail_extract_error');
      throw error;
    }
  } catch (error) {
    console.error('詳細ページの処理中にエラーが発生しました:', error);
    return null;
  }
}

// 管理状況（利用分野）情報を抽出する関数
async function extractUsagePermissions(page: Page): Promise<UsagePermission> {
  console.log('管理状況（利用分野）情報を抽出中...');
  
  const usagePermission: UsagePermission = {
    // 演奏カテゴリ
    performance: {
      concert: false,     // 演奏会等
      bgm: false,         // 上映/BGM
      karaoke: false,     // 社交場/カラオケ
    },
    // 複製カテゴリ
    reproduction: {
      recording: false,   // 録音
      publication: false, // 出版
      rental: false,      // 貸与
      video: false,       // ビデオ
      movie: false,       // 映画
    },
    // 公衆送信カテゴリ
    transmission: {
      broadcast: false,   // 放送
      distribution: false,// 配信
      karaoke_comm: false,// 通カラ
    },
    // 広告カテゴリ
    advertisement: {
      cm: false,          // 広告/CM送録
      movie_ad: false,    // 広告/映録
      recording_ad: false,// 広告/録音
      video_ad: false,    // 広告/ビデオ
      publication_ad: false, // 広告/出版
    },
    // ゲームカテゴリ
    game: {
      recording_game: false, // ゲーム/録音
      video_game: false,     // ゲーム/ビデオ
    },
    // 管理状況の詳細テキスト
    managementDetails: {}
  };

  try {
    // 各タブの存在チェック
    const tabIds = [
      // 演奏
      'tab-00-00', // 演奏
      'tab-99-03', // 社交場/カラオケ
      // 複製
      'tab-00-01', // 録音
      'tab-00-02', // 出版
      'tab-00-03', // 貸与
      'tab-00-04', // ビデオ
      'tab-00-05', // 映画
      // 公衆送信
      'tab-00-06', // 放送
      'tab-00-07', // 配信
      'tab-00-08', // 通カラ
      // 広告
      'tab-01-00', // 広告/CM送録
      'tab-01-01', // 広告/映録
      'tab-01-02', // 広告/録音
      'tab-01-03', // 広告/ビデオ
      'tab-01-04', // 広告/出版
      // ゲーム
      'tab-02-00', // ゲーム/録音
      'tab-02-01'  // ゲーム/ビデオ
    ];
    
    for (const tabId of tabIds) {
      const tabExists = await page.$(`#${tabId}`);
      if (tabExists) {
        // タブの中のテキストを取得
        const tabContent = await page.$eval(`#${tabId} dl.consent dd.txt p`, 
          (el: Element) => el.textContent?.trim() || '');
        
        // 「この利用分野は、JASRACが著作権を管理しています。」という文言があれば許可されている
        const isPermitted = tabContent.includes('JASRACが著作権を管理しています');
        
        // 管理詳細情報を取得
        const managementDetailText = await page.$$eval(`#${tabId} table.detail tr`, 
          (rows: Element[]) => {
            return rows.map(row => row.textContent?.trim()).join(' | ');
          });

        // タブIDに基づいて対応するフラグを設定
        switch(tabId) {
          // 演奏カテゴリ
          case 'tab-00-00': 
            usagePermission.performance.concert = isPermitted; 
            usagePermission.managementDetails['演奏'] = managementDetailText;
            break;
          case 'tab-99-03': 
            usagePermission.performance.karaoke = isPermitted; 
            usagePermission.managementDetails['社交場/カラオケ'] = managementDetailText;
            break;
          // 複製カテゴリ
          case 'tab-00-01': 
            usagePermission.reproduction.recording = isPermitted; 
            usagePermission.managementDetails['録音'] = managementDetailText;
            break;
          case 'tab-00-02': 
            usagePermission.reproduction.publication = isPermitted; 
            usagePermission.managementDetails['出版'] = managementDetailText;
            break;
          case 'tab-00-03': 
            usagePermission.reproduction.rental = isPermitted; 
            usagePermission.managementDetails['貸与'] = managementDetailText;
            break;
          case 'tab-00-04': 
            usagePermission.reproduction.video = isPermitted; 
            usagePermission.managementDetails['ビデオ'] = managementDetailText;
            break;
          case 'tab-00-05': 
            usagePermission.reproduction.movie = isPermitted; 
            usagePermission.managementDetails['映画'] = managementDetailText;
            break;
          // 公衆送信カテゴリ
          case 'tab-00-06': 
            usagePermission.transmission.broadcast = isPermitted; 
            usagePermission.managementDetails['放送'] = managementDetailText;
            break;
          case 'tab-00-07': 
            usagePermission.transmission.distribution = isPermitted; 
            usagePermission.managementDetails['配信'] = managementDetailText;
            break;
          case 'tab-00-08': 
            usagePermission.transmission.karaoke_comm = isPermitted; 
            usagePermission.managementDetails['通カラ'] = managementDetailText;
            break;
          // 広告カテゴリ
          case 'tab-01-00': 
            usagePermission.advertisement.cm = isPermitted; 
            usagePermission.managementDetails['広告/CM送録'] = managementDetailText;
            break;
          case 'tab-01-01': 
            usagePermission.advertisement.movie_ad = isPermitted; 
            usagePermission.managementDetails['広告/映録'] = managementDetailText;
            break;
          case 'tab-01-02': 
            usagePermission.advertisement.recording_ad = isPermitted; 
            usagePermission.managementDetails['広告/録音'] = managementDetailText;
            break;
          case 'tab-01-03': 
            usagePermission.advertisement.video_ad = isPermitted; 
            usagePermission.managementDetails['広告/ビデオ'] = managementDetailText;
            break;
          case 'tab-01-04': 
            usagePermission.advertisement.publication_ad = isPermitted; 
            usagePermission.managementDetails['広告/出版'] = managementDetailText;
            break;
          // ゲームカテゴリ
          case 'tab-02-00': 
            usagePermission.game.recording_game = isPermitted; 
            usagePermission.managementDetails['ゲーム/録音'] = managementDetailText;
            break;
          case 'tab-02-01': 
            usagePermission.game.video_game = isPermitted; 
            usagePermission.managementDetails['ゲーム/ビデオ'] = managementDetailText;
            break;
        }
      }
    }
  } catch (error) {
    console.error('管理状況（利用分野）情報の抽出中にエラーが発生しました:', error);
  }
  
  return usagePermission;
}

// 利用許可情報をフォーマットする関数
function formatUsagePermissions(permissions: UsagePermission): string {
  const result: string[] = [];
  
  // 演奏カテゴリ
  if (permissions.performance.concert) result.push('演奏:演奏会等');
  if (permissions.performance.bgm) result.push('演奏:上映/BGM');
  if (permissions.performance.karaoke) result.push('演奏:社交場/カラオケ');
  
  // 複製カテゴリ
  if (permissions.reproduction.recording) result.push('複製:録音');
  if (permissions.reproduction.publication) result.push('複製:出版');
  if (permissions.reproduction.rental) result.push('複製:貸与');
  if (permissions.reproduction.video) result.push('複製:ビデオ');
  if (permissions.reproduction.movie) result.push('複製:映画');
  
  // 公衆送信カテゴリ
  if (permissions.transmission.broadcast) result.push('公衆送信:放送');
  if (permissions.transmission.distribution) result.push('公衆送信:配信');
  if (permissions.transmission.karaoke_comm) result.push('公衆送信:通カラ');
  
  // 広告カテゴリ
  if (permissions.advertisement.cm) result.push('広告:CM送録');
  if (permissions.advertisement.movie_ad) result.push('広告:映録');
  if (permissions.advertisement.recording_ad) result.push('広告:録音');
  if (permissions.advertisement.video_ad) result.push('広告:ビデオ');
  if (permissions.advertisement.publication_ad) result.push('広告:出版');
  
  // ゲームカテゴリ
  if (permissions.game.recording_game) result.push('ゲーム:録音');
  if (permissions.game.video_game) result.push('ゲーム:ビデオ');
  
  return result.join('|');
}

async function writeTsvFile(songs: JasracInfo[], outputPath: string) {
  console.log(`TSVファイルに${songs.length}曲の情報を書き込みます: ${outputPath}`);
  
  // 拡張ヘッダーを追加
  const header = 'インターフェイスキーコード\tコンテンツ区分\tコンテンツ枝番\tメドレー区分\tメドレー枝番\tコレクトコード\tＪＡＳＲＡＣ作品コード\t原題名\t副題・邦題\t作詞者名\t補作詞・訳詞者名\t作曲者名\t編曲者名\tアーティスト名\t情報料（税抜）\tＩＶＴ区分\t原詞訳詞区分\tIL区分\tリクエスト回数\t演奏時間\t作品種別\t国籍区分\t作成年月日\t利用分野\t出版社\t権利者情報\n';
  
  // 各曲の情報をTSVフォーマットに変換
  let tsvContent = header;
  songs.forEach((song, index) => {
    // コード部分（サンプルに基づく）
    const workCodeFormatted = song.workCode.replace(/-/g, '');
    
    // 権利者情報を文字列に変換
    const rightsInfoStr = song.rightsInfo 
      ? song.rightsInfo.map(ri => `${ri.name}(${ri.role},${ri.shares},${ri.society})`).join('|') 
      : '';
    
    // 1行に全ての情報をタブ区切りで出力
    tsvContent += `${index+1}\t\t000\t\t000\t\t${workCodeFormatted}\t${song.title}\t\t${song.lyricist}\t\t${song.composer}\t${song.arranger}\t${song.artist}\t0\tI\t\t\t0\t${song.duration}\t${song.workType}\t${song.nationality}\t${song.creationDate}\t${song.usageCategory}\t${song.publisher}\t${rightsInfoStr}\n`;
  });
  
  // 拡張情報を含むTSVファイルも出力（詳細な情報）
  const detailedOutputPath = outputPath.replace('.tsv', '-detailed.tsv');
  
  // 詳細なヘッダー
  const detailedHeader = '作品コード\tタイトル\t作詞者\t作曲者\t編曲者\tアーティスト\t演奏時間\t作品種別\t国籍区分\t作成年月日\t利用分野\t出版社\t利用許可情報\t権利者情報\n';
  
  // 詳細な情報をTSVフォーマットに変換
  let detailedContent = detailedHeader;
  songs.forEach(song => {
    // 権利者情報を文字列に変換
    const rightsInfoStr = song.rightsInfo 
      ? song.rightsInfo.map(ri => `${ri.name}(${ri.role},${ri.shares},${ri.society})`).join('|') 
      : '';
    
    // 利用許可情報を文字列に変換
    const usagePermissionStr = song.usagePermissions ? formatUsagePermissions(song.usagePermissions) : '';
    
    detailedContent += `${song.workCode}\t${song.title}\t${song.lyricist}\t${song.composer}\t${song.arranger}\t${song.artist}\t${song.duration}\t${song.workType}\t${song.nationality}\t${song.creationDate}\t${song.usageCategory}\t${song.publisher}\t${usagePermissionStr}\t${rightsInfoStr}\n`;
  });
  
  // ファイルに書き込み
  fs.writeFileSync(outputPath, tsvContent);
  fs.writeFileSync(detailedOutputPath, detailedContent);
  
  console.log(`TSVファイルを保存しました: ${outputPath}`);
  console.log(`詳細TSVファイルを保存しました: ${detailedOutputPath}`);
  
  // また、デバッグ用にJSONファイルも保存
  const jsonPath = outputFilePath.endsWith('.json') ? outputFilePath : `${outputFilePath}.json`;
  fs.writeFileSync(jsonPath, JSON.stringify(songs, null, 2));
  console.log(`JSONファイルを保存しました: ${jsonPath}`);
  
  // HTML保存
  const htmlDir = path.join(path.dirname(outputPath), 'html');
  if (!fs.existsSync(htmlDir)) {
    fs.mkdirSync(htmlDir, { recursive: true });
  }
  
  // 各曲のHTMLを保存（空白削除済みのHTMLを使用）
  songs.forEach(song => {
    const htmlPath = path.join(htmlDir, `${song.workCode.replace(/-/g, '')}.html`);
    if (song.rawHtml) {
      fs.writeFileSync(htmlPath, song.rawHtml);
    }
  });
  
  // 内容の確認出力
  console.log('--- TSVファイルの内容確認（先頭部分のみ） ---');
  const lines = tsvContent.split('\n');
  console.log(lines[0]);
  console.log('...（データ行は省略）...');
  console.log('--------------------------');
}

async function main() {
  console.log('JASRACデータ収集プログラムを開始します');
  
  // ブラウザ変数をスコープ外で宣言
  let browser;
  
  try {
    // 曲情報リストを取得（入力ファイルから）
    const songs = await getSongList();
    console.log(`${songs.length}曲の情報を処理します`);
    
    // ダミーモードならブラウザを起動せずにダミーデータを生成
    if (DUMMY_MODE) {
      console.log('ダミーモードで実行しています。実際の検索は行いません。');
      const jasracInfos = songs.map((song, index) => {
        console.log(`ダミーデータ生成: ${song.title}`);
        return {
          workCode: `${100000 + index}`,
          title: song.title,
          lyricist: song.lyricist || '不明',
          composer: song.composer || '不明',
          artist: song.artist || '不明',
          arranger: '',
          duration: '03:45',
          workType: '歌曲',
          nationality: '内国作品',
          creationDate: '2020-01-01',
          rightsInfo: [],
          usageCategory: '演奏',
          publisher: '',
          sourceType: 'PO(出版者作品届)',  // ダミーデータに出典情報を追加
          usagePermissions: {
            performance: { concert: true, bgm: true, karaoke: true },
            reproduction: { recording: true, publication: false, rental: false, video: true, movie: false },
            transmission: { broadcast: true, distribution: true, karaoke_comm: false },
            advertisement: { cm: false, movie_ad: false, recording_ad: false, video_ad: false, publication_ad: false },
            game: { recording_game: false, video_game: false },
            managementDetails: {}
          },
          rawHtml: '',
          alternatives: []
        };
      });

      // 出力ディレクトリが存在しない場合は作成
      const outputDir = path.dirname(outputFilePath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // TSVファイルに出力
      const tsvPath = `${outputFilePath}.tsv`;
      await writeTsvFile(jasracInfos, tsvPath);
      
      // JSON形式でも出力 (APIで使用)
      const jsonPath = outputFilePath.endsWith('.json') ? outputFilePath : `${outputFilePath}.json`;
      fs.writeFileSync(jsonPath, JSON.stringify(jasracInfos, null, 2));
      console.log(`JSONファイルを保存しました: ${jsonPath}`);
      
      console.log('ダミーモードでの処理が完了しました');
      return;
    }
    
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox'] 
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });
    
    const page = await context.newPage();
    
    // 各曲のJASRAC情報を検索
    const jasracInfos: JasracInfo[] = [];
    for (const song of songs) {
      const info = await searchJasrac(page, song);
      if (info) {
        jasracInfos.push(info);
        console.log(`「${song.title}」の情報を取得しました: ${info.workCode}`);
      } else {
        console.log(`「${song.title}」の情報は見つかりませんでした`);
      }
    }
    
    // 結果があるか確認
    if (jasracInfos.length === 0) {
      console.log('有効な曲情報が見つかりませんでした。処理を終了します。');
    } else {
      // 出力ディレクトリが存在しない場合は作成
      const outputDir = path.dirname(outputFilePath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // TSVファイルに出力
      const tsvPath = `${outputFilePath}.tsv`;
      await writeTsvFile(jasracInfos, tsvPath);
      
      // JSON形式でも出力 (APIで使用)
      const jsonPath = outputFilePath.endsWith('.json') ? outputFilePath : `${outputFilePath}.json`;
      fs.writeFileSync(jsonPath, JSON.stringify(jasracInfos, null, 2));
      console.log(`JSONファイルを保存しました: ${jsonPath}`);
    }
    
    console.log('処理が完了しました');
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  } finally {
    if (!DUMMY_MODE && browser) {
      try {
        await browser.close();
      } catch (e) {
        console.error('ブラウザを閉じる際にエラーが発生しました:', e);
      }
    }
  }
}

// プログラムを実行
main().catch(error => {
  console.error('プログラム実行中にエラーが発生しました:', error);
  process.exit(1);
}); 