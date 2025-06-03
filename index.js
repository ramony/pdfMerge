import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import * as fontkit from 'fontkit';
import io from './lib/io.js';

// 主函数
async function main() {
  const [config, configExist] = io.tryReadYAML("config/text.yaml", { x: 100, y: 20, text: "示例文字" });
  if (!configExist) {
    console.log(`创建任务配置文件config/text.yaml,请配置任务信息`);
    return;
  }
  io.mkdir("output")
  console.log('开始任务........................');
  const searchDirectory = config.path;
  await merge('滴滴电子发票', searchDirectory, config);
  await merge('滴滴出行行程报销单', searchDirectory, config);
}

// 递归搜索指定目录下包含关键词的 PDF 文件
function searchPDFs(dir, keyword) {
  const pdfFiles = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      pdfFiles.push(...searchPDFs(entryPath, keyword));
    } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.pdf' && entry.name.includes(keyword)) {
      pdfFiles.push(entryPath);
    }
  }
  return pdfFiles;
}

async function addText(pdfDoc, x, y, text) {
  // 加载中文字体，这里使用宋体
  const fontBytes = fs.readFileSync(path.join('ttf', 'simsun.ttf'));
  const font = await pdfDoc.embedFont(fontBytes);

  // 遍历文档中的每一页
  const pages = pdfDoc.getPages();
  for (const page of pages) {
    // 获取页面的宽度和高度
    const { width, height } = page.getSize();
    // 在页面上添加指定的文本
    page.drawText(text, {
      x: x,
      y: height - y,
      size: 14,
      font: font,
      color: rgb(0, 0.7, 0.5),
    });
  }
}

// 合并 PDF 文件
async function mergePDFs(inputPaths, outputPath, config) {
  const mergedPdf = await PDFDocument.create();

  for (const inputPath of inputPaths) {
    const pdfBytes = fs.readFileSync(inputPath);
    const inputPdf = await PDFDocument.load(pdfBytes);
    inputPdf.registerFontkit(fontkit);

    await addText(inputPdf, config.x, config.y, config.text);
    const pages = await mergedPdf.copyPages(inputPdf, inputPdf.getPageIndices());
    pages.forEach((page) => {
      mergedPdf.addPage(page);
    });
  }

  const mergedPdfBytes = await mergedPdf.save();
  fs.writeFileSync(outputPath, mergedPdfBytes);
  console.log(`PDF 文件已合并并保存到 ${outputPath}`);
}

async function merge(keyword, searchDir, config) {
  const pdfFiles = searchPDFs(searchDir, keyword);
  if (pdfFiles.length === 0) {
    console.log('未找到包含关键词的 PDF 文件。');
    return;
  }
  const outputPDF = path.join('output', keyword + '_merged.pdf');
  await mergePDFs(pdfFiles, outputPDF, config);
  console.error('合并完成:', keyword);
}

main();
