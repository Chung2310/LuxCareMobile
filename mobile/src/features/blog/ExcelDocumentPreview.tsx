import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { PreviewDocument } from "./documentPreview";
import { excelPage, readExcelPreview } from "./excelPreview";

export function ExcelDocumentPreview({ document, onLoaded, onError }: {
  document: PreviewDocument; onLoaded: () => void; onError: (message: string) => void;
}) {
  const [sheetIndex, setSheetIndex] = useState(0), [page, setPage] = useState(0);
  const result = useMemo(() => {
    try { return { workbook: readExcelPreview(document.base64) }; }
    catch { return { error: "Không đọc được tệp Excel. Tệp có thể bị hỏng hoặc được bảo vệ bằng mật khẩu." }; }
  }, [document]);
  useEffect(() => { if (result.error) onError(result.error); else onLoaded(); }, [result, onError, onLoaded]);
  const workbook = result.workbook;
  if (!workbook) return null;
  const sheetName = workbook.SheetNames[sheetIndex] || workbook.SheetNames[0];
  const data = excelPage(workbook, sheetName, page);
  return <View style={{ flex: 1 }}>
    <View><ScrollView horizontal contentContainerStyle={styles.tabs}>
      {workbook.SheetNames.map((name, index) => <Pressable key={name} accessibilityRole="tab"
        accessibilityState={{ selected: name === sheetName }} onPress={() => { setSheetIndex(index); setPage(0); }} style={styles.button}>
        <Text style={{ color: name === sheetName ? "#4f46e5" : "#334155", fontWeight: name === sheetName ? "700" : "400" }}>{name}</Text>
      </Pressable>)}
    </ScrollView></View>
    {data.limited && <Text style={styles.notice}>Xem trước tối đa 10.000 dòng và 200 cột mỗi trang tính.</Text>}
    {!data.rows.length ? <Text style={styles.notice}>Trang tính trống.</Text> :
      <ScrollView style={{ flex: 1 }}><ScrollView horizontal><View>
        <View style={styles.row}><Text style={[styles.cell, styles.number]}>#</Text>{data.columns.map(column => <Text key={column} style={[styles.cell, styles.heading]}>{column}</Text>)}</View>
        {data.rows.map((row, index) => <View key={data.firstRow + index} style={styles.row}>
          <Text style={[styles.cell, styles.number]}>{data.firstRow + index}</Text>
          {row.map((value, column) => <Text key={column} selectable style={styles.cell}>{value}</Text>)}
        </View>)}
      </View></ScrollView></ScrollView>}
    <View style={styles.tabs}>
      <Pressable accessibilityRole="button" disabled={page <= 0} onPress={() => setPage(value => value - 1)} style={styles.button}><Text style={{ opacity: page <= 0 ? 0.35 : 1 }}>Trước</Text></Pressable>
      <Text>Trang {page + 1}/{data.pages}</Text>
      <Pressable accessibilityRole="button" disabled={page + 1 >= data.pages} onPress={() => setPage(value => value + 1)} style={styles.button}><Text style={{ opacity: page + 1 >= data.pages ? 0.35 : 1 }}>Sau</Text></Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: 12, padding: 12, alignItems: "center" },
  button: { padding: 10, backgroundColor: "#fff", borderRadius: 8 },
  notice: { padding: 12, color: "#475569" },
  row: { flexDirection: "row", alignItems: "stretch" },
  cell: { width: 150, padding: 8, borderWidth: 0.5, borderColor: "#cbd5e1", backgroundColor: "white", color: "#0f172a" },
  number: { width: 60, backgroundColor: "#e2e8f0" },
  heading: { fontWeight: "600", backgroundColor: "#e2e8f0" },
});
