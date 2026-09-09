import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import type { UserProfile } from "../../../src/types/common";
import { roster } from "../../src/api/services";
import { messageOf, useSession } from "../../src/auth/SessionProvider";

/* ==========================================================================
   1. FUNCTIONAL CATEGORIES (Theo chuẩn LuxCare Web)
   ========================================================================== */
interface FunctionalCategory {
  key: string;
  label: string;
  badge: string;
  color: string;
  bg: string;
  border: string;
  text: string;
}

const FUNCTIONAL_CATEGORIES: FunctionalCategory[] = [
  {
    key: "governance",
    label: "Quản trị",
    badge: "GOVERNANCE",
    color: "#0f172a",
    bg: "#f1f5f9",
    border: "#0f172a",
    text: "#0f172a",
  },
  {
    key: "finance",
    label: "Tài chính - Pháp lý",
    badge: "FINANCE",
    color: "#10b981",
    bg: "#ecfdf5",
    border: "#10b981",
    text: "#047857",
  },
  {
    key: "tech",
    label: "Hệ thống & Công nghệ",
    badge: "TECH",
    color: "#4f46e5",
    bg: "#eef2ff",
    border: "#4f46e5",
    text: "#4338ca",
  },
  {
    key: "operations",
    label: "Vận hành - Sản xuất",
    badge: "OPERATIONS",
    color: "#06b6d4",
    bg: "#ecfeff",
    border: "#06b6d4",
    text: "#0e7490",
  },
  {
    key: "sales",
    label: "Kinh doanh & Tiếp thị",
    badge: "SALES",
    color: "#f59e0b",
    bg: "#fffbeb",
    border: "#f59e0b",
    text: "#b45309",
  },
  {
    key: "hr",
    label: "Hành chính & Nhân sự",
    badge: "HR",
    color: "#f43f5e",
    bg: "#fff1f2",
    border: "#f43f5e",
    text: "#be123c",
  },
];

function getCategoryByDivision(divisionOrDept?: string): FunctionalCategory {
  const d = (divisionOrDept || "").toLowerCase();
  if (
    d.includes("quản trị") ||
    d.includes("ban giám đốc") ||
    d.includes("hội đồng") ||
    d.includes("governance") ||
    d.includes("board") ||
    d.includes("ceo") ||
    d.includes("tổng giám đốc")
  ) {
    return FUNCTIONAL_CATEGORIES[0];
  }
  if (
    d.includes("tài chính") ||
    d.includes("kế toán") ||
    d.includes("pháp lý") ||
    d.includes("finance") ||
    d.includes("legal") ||
    d.includes("accounting")
  ) {
    return FUNCTIONAL_CATEGORIES[1];
  }
  if (
    d.includes("kỹ thuật") ||
    d.includes("công nghệ") ||
    d.includes("hệ thống") ||
    d.includes("tech") ||
    d.includes("it") ||
    d.includes("phần mềm") ||
    d.includes("software")
  ) {
    return FUNCTIONAL_CATEGORIES[2];
  }
  if (
    d.includes("vận hành") ||
    d.includes("sản xuất") ||
    d.includes("kho") ||
    d.includes("operations") ||
    d.includes("logistics")
  ) {
    return FUNCTIONAL_CATEGORIES[3];
  }
  if (
    d.includes("kinh doanh") ||
    d.includes("tiếp thị") ||
    d.includes("sales") ||
    d.includes("marketing") ||
    d.includes("csm") ||
    d.includes("cso") ||
    d.includes("thương mại")
  ) {
    return FUNCTIONAL_CATEGORIES[4];
  }
  if (
    d.includes("nhân sự") ||
    d.includes("hành chính") ||
    d.includes("hr") ||
    d.includes("admin") ||
    d.includes("tuyển dụng") ||
    d.includes("đào tạo")
  ) {
    return FUNCTIONAL_CATEGORIES[5];
  }
  return FUNCTIONAL_CATEGORIES[5];
}

function getRoleIcon(roleTitle?: string): string {
  const r = (roleTitle || "").toLowerCase();
  if (
    r.includes("ceo") ||
    r.includes("chủ tịch") ||
    r.includes("coo") ||
    r.includes("cfo") ||
    r.includes("cmo") ||
    r.includes("cso") ||
    r.includes("director") ||
    r.includes("giám đốc") ||
    r.includes("tổng")
  ) {
    return "👑";
  }
  if (
    r.includes("trưởng phòng") ||
    r.includes("manager") ||
    r.includes("leader") ||
    r.includes("trưởng nhóm") ||
    r.includes("phó")
  ) {
    return "💼";
  }
  return "👤";
}

type RoleBadge = { label: string; bg: string; text: string; border: string; rank: number };

function roleBadge(role?: string): RoleBadge {
  switch (role) {
    case "superadmin":   return { label: "Tổng GĐ",      bg: "#f5f3ff", text: "#7c3aed", border: "#ddd6fe", rank: 0 };
    case "admin":        return { label: "Ban GĐ",        bg: "#fffbeb", text: "#b45309", border: "#fde68a", rank: 1 };
    case "branch_owner": return { label: "GĐ Chi Nhánh", bg: "#ecfdf5", text: "#047857", border: "#a7f3d0", rank: 2 };
    case "manager":      return { label: "Quản Lý",       bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe", rank: 3 };
    default:             return { label: "Nhân Viên",     bg: "#f1f5f9", text: "#475569", border: "#e2e8f0", rank: 9 };
  }
}

function initials(name: string): string {
  return name.split(/\s+/).slice(-2).map((w) => w[0] ?? "").join("").toUpperCase();
}

function isHttpUrl(url?: string): boolean {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://");
}

/* ==========================================================================
   2. TREE DATA STRUCTURE
   ========================================================================== */
interface TreeNode {
  emp: UserProfile;
  children: TreeNode[];
  depth: number;
}

function buildTree(emps: UserProfile[]): TreeNode[] {
  const byUid = new Map(emps.map((e) => [e.uid, e]));
  const uidSet = new Set(emps.map((e) => e.uid));
  const roots = emps
    .filter((e) => !e.parentId || !uidSet.has(e.parentId))
    .sort((a, b) => {
      const la = a.level ?? 99;
      const lb = b.level ?? 99;
      return la !== lb ? la - lb : (a.displayName ?? "").localeCompare(b.displayName ?? "");
    });

  function build(uid: string, depth: number): TreeNode {
    const emp = byUid.get(uid)!;
    const children = emps
      .filter((e) => e.parentId === uid && e.uid !== uid)
      .sort((a, b) => {
        const la = a.level ?? 99;
        const lb = b.level ?? 99;
        return la !== lb ? la - lb : (a.displayName ?? "").localeCompare(b.displayName ?? "");
      })
      .map((c) => build(c.uid, depth + 1));
    return { emp, children, depth };
  }

  return roots.map((r) => build(r.uid, 0));
}

function flattenSearchMatches(nodes: TreeNode[], sq: string): Set<string> {
  const matched = new Set<string>();
  function walk(n: TreeNode) {
    const e = n.emp;
    if (
      e.displayName?.toLowerCase().includes(sq) ||
      e.jobTitle?.toLowerCase().includes(sq) ||
      e.department?.toLowerCase().includes(sq) ||
      e.email?.toLowerCase().includes(sq)
    ) {
      matched.add(e.uid);
    }
    n.children.forEach(walk);
  }
  nodes.forEach(walk);
  return matched;
}

/* ==========================================================================
   3. ATOMS & MODALS
   ========================================================================== */
function Avatar({
  url,
  name,
  size,
  bg,
  col,
}: {
  url?: string;
  name: string;
  size: number;
  bg: string;
  col: string;
}) {
  if (isHttpUrl(url)) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: col, fontWeight: "800", fontSize: size * 0.38 }}>
        {initials(name)}
      </Text>
    </View>
  );
}

function IRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={s.iRow}>
      <Text style={s.iIco}>{icon}</Text>
      <Text style={s.iLbl}>{label}</Text>
      <Text style={s.iVal} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function ProfileModal({
  emp,
  managerName,
  onClose,
}: {
  emp: UserProfile | null;
  managerName?: string;
  onClose: () => void;
}) {
  if (!emp) return null;
  const b = roleBadge(emp.role);
  const cat = getCategoryByDivision(emp.department || emp.division);
  const roleIcon = getRoleIcon(emp.jobTitle || emp.role);

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <View style={s.handle} />
          <View style={{ alignItems: "center", marginTop: 4, marginBottom: 18 }}>
            <Avatar
              url={emp.photoURL}
              name={emp.displayName ?? "?"}
              size={68}
              bg={cat.bg}
              col={cat.text}
            />
            <Text style={s.mName}>{emp.displayName}</Text>
            <Text style={s.mSub}>
              {roleIcon} {emp.jobTitle || b.label}
            </Text>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
              {emp.isLeader && (
                <View style={s.leaderBadgeLarge}>
                  <Text style={s.leaderTextLarge}>👑 Leader</Text>
                </View>
              )}
              <View style={[s.pill, { backgroundColor: cat.bg, borderColor: cat.color }]}>
                <Text style={[s.pillTxt, { color: cat.text }]}>{cat.badge}</Text>
              </View>
            </View>
          </View>

          <View style={s.infoBlock}>
            {!!emp.department && <IRow icon="🏢" label="Phòng ban" value={emp.department} />}
            <IRow
              icon="👤"
              label="Quản lý"
              value={managerName || "Cấp cao nhất / Không có"}
            />
            {!!emp.email && <IRow icon="✉️" label="Email" value={emp.email} />}
            {!!emp.phone && <IRow icon="📱" label="Điện thoại" value={emp.phone} />}
            {!!emp.division && <IRow icon="📁" label="Khối" value={emp.division} />}
          </View>

          <View style={s.actionRow}>
            {!!emp.phone && (
              <Pressable
                style={s.actionBtn}
                onPress={() => void Linking.openURL(`tel:${emp.phone}`)}
              >
                <Text style={s.actionIco}>📞</Text>
                <Text style={s.actionLbl}>Gọi điện</Text>
              </Pressable>
            )}
            {!!emp.email && (
              <Pressable
                style={s.actionBtn}
                onPress={() => void Linking.openURL(`mailto:${emp.email}`)}
              >
                <Text style={s.actionIco}>✉️</Text>
                <Text style={s.actionLbl}>Gửi email</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ==========================================================================
   4. TOP-DOWN SMART CARD & RECURSIVE BRANCH (Chuẩn Luxcare Web)
   ========================================================================== */
const CARD_WIDTH = 206;
const CARD_MARGIN = 12;

function TreeBranchView({
  node,
  onSelect,
  collapsed,
  toggleCollapse,
  highlighted,
}: {
  node: TreeNode;
  onSelect: (e: UserProfile) => void;
  collapsed: Set<string>;
  toggleCollapse: (uid: string) => void;
  highlighted: Set<string> | null;
}) {
  const { emp, children } = node;
  const isCollapsed = collapsed.has(emp.uid);
  const hasChildren = children.length > 0;
  const isHighlighted = highlighted ? highlighted.has(emp.uid) : false;
  const dimmed = highlighted !== null && !isHighlighted;
  const cat = getCategoryByDivision(emp.department || emp.division);
  const roleIcon = getRoleIcon(emp.jobTitle || emp.role);
  const directReports = children.length;

  return (
    <View style={s.branchCol}>
      {/* Smart Employee Card */}
      <Pressable
        onPress={() => onSelect(emp)}
        style={[
          s.card,
          { borderTopColor: cat.color },
          isHighlighted && s.cardHighlighted,
          dimmed && s.cardDimmed,
        ]}
      >
        {/* Top Header Row: Category Badge / Leader & Online Dot */}
        <View style={s.cardTopRow}>
          {emp.isLeader ? (
            <View style={s.leaderBadge}>
              <Text style={s.leaderText}>👑 LEADER</Text>
            </View>
          ) : (
            <View style={[s.catBadge, { backgroundColor: cat.bg }]}>
              <Text style={[s.catBadgeText, { color: cat.text }]}>{cat.badge}</Text>
            </View>
          )}
          <View
            style={[
              s.onlineDot,
              { backgroundColor: emp.status === "online" ? "#10b981" : "#cbd5e1" },
            ]}
          />
        </View>

        {/* Department Title (Main highlight) */}
        <View style={s.deptContainer}>
          <Text style={s.deptName} numberOfLines={2}>
            {emp.department || "Ban Giám đốc"}
          </Text>
        </View>

        {/* Employee Info Row */}
        <View style={s.cardBottomRow}>
          <Avatar
            url={emp.photoURL}
            name={emp.displayName ?? "?"}
            size={30}
            bg={cat.bg}
            col={cat.text}
          />
          <View style={s.cardMeta}>
            <Text style={s.roleText} numberOfLines={1}>
              {roleIcon} {emp.jobTitle || roleBadge(emp.role).label}
            </Text>
            <Text style={s.nameText} numberOfLines={1}>
              {emp.displayName}
            </Text>
          </View>
        </View>

        {/* Collapse / Expand toggle button at bottom border */}
        {hasChildren && (
          <Pressable
            hitSlop={8}
            style={[
              s.toggleBadge,
              {
                backgroundColor: isCollapsed ? "#eff6ff" : "#ecfdf5",
                borderColor: isCollapsed ? "#6366f1" : "#10b981",
              },
            ]}
            onPress={(e) => {
              e.stopPropagation();
              toggleCollapse(emp.uid);
            }}
          >
            <Text
              style={[
                s.toggleText,
                { color: isCollapsed ? "#4f46e5" : "#059669" },
              ]}
            >
              {isCollapsed ? `+${directReports}` : "▲"}
            </Text>
          </Pressable>
        )}
      </Pressable>

      {/* Children connector lines & subtrees */}
      {hasChildren && !isCollapsed && (
        <View style={s.childrenContainer}>
          {/* Vertical stem line dropping from parent card */}
          <View style={s.stemLine} />

          {/* Children horizontal branch */}
          <View style={s.childrenRow}>
            {children.map((child, index) => {
              const isFirst = index === 0;
              const isLast = index === children.length - 1;
              const hasSiblings = children.length > 1;

              return (
                <View key={child.emp.uid} style={s.childWrapper}>
                  {/* Horizontal connector bar */}
                  {hasSiblings && (
                    <View style={s.connectorBar}>
                      <View
                        style={[
                          s.connectorHalf,
                          !isFirst && s.connectorBorder,
                        ]}
                      />
                      <View
                        style={[
                          s.connectorHalf,
                          !isLast && s.connectorBorder,
                        ]}
                      />
                    </View>
                  )}

                  {/* Vertical stem entering child card */}
                  <View style={s.stemLine} />

                  {/* Child subtree */}
                  <TreeBranchView
                    node={child}
                    onSelect={onSelect}
                    collapsed={collapsed}
                    toggleCollapse={toggleCollapse}
                    highlighted={highlighted}
                  />
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

/* ==========================================================================
   5. LIST VIEW COMPONENT (Chế độ Danh sách giống Web)
   ========================================================================== */
function OrgListView({
  emps,
  onSelect,
  highlighted,
}: {
  emps: UserProfile[];
  onSelect: (e: UserProfile) => void;
  highlighted: Set<string> | null;
}) {
  const managerMap = useMemo(() => {
    const map = new Map<string, string>();
    emps.forEach((e) => {
      if (e.displayName) map.set(e.uid, e.displayName);
    });
    return map;
  }, [emps]);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.listContainer} showsVerticalScrollIndicator={false}>
      {emps.map((emp) => {
        const cat = getCategoryByDivision(emp.department || emp.division);
        const roleIcon = getRoleIcon(emp.jobTitle || emp.role);
        const isHighlighted = highlighted ? highlighted.has(emp.uid) : false;
        const dimmed = highlighted !== null && !isHighlighted;
        const mgrName = emp.parentId ? managerMap.get(emp.parentId) : undefined;

        return (
          <Pressable
            key={emp.uid}
            onPress={() => onSelect(emp)}
            style={[
              s.listCard,
              { borderLeftColor: cat.color },
              isHighlighted && s.cardHighlighted,
              dimmed && s.cardDimmed,
            ]}
          >
            <Avatar
              url={emp.photoURL}
              name={emp.displayName ?? "?"}
              size={42}
              bg={cat.bg}
              col={cat.text}
            />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={s.listEmpName}>{emp.displayName}</Text>
                {emp.isLeader && (
                  <View style={s.leaderBadge}>
                    <Text style={s.leaderText}>👑</Text>
                  </View>
                )}
              </View>
              <Text style={s.listEmpRole}>
                {roleIcon} {emp.jobTitle || roleBadge(emp.role).label}
              </Text>
              <Text style={s.listEmpDept}>
                🏢 {emp.department || "Ban Giám đốc"}
                {mgrName ? ` · 👤 QL: ${mgrName}` : ""}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              <View style={[s.catBadge, { backgroundColor: cat.bg }]}>
                <Text style={[s.catBadgeText, { color: cat.text }]}>{cat.badge}</Text>
              </View>
              {!!emp.phone && (
                <Pressable
                  hitSlop={8}
                  style={s.listCallBtn}
                  onPress={() => void Linking.openURL(`tel:${emp.phone}`)}
                >
                  <Text style={{ fontSize: 13 }}>📞</Text>
                </Pressable>
              )}
            </View>
          </Pressable>
        );
      })}
      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

/* ==========================================================================
   6. MAIN ORG CHART SCREEN
   ========================================================================== */
export default function OrgChart() {
  const { user, selectedBranch } = useSession();
  const branchId = selectedBranch?._id || user?.branchId || undefined;
  const [empList, setEmpList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<UserProfile | null>(null);
  const [viewMode, setViewMode] = useState<"tree" | "list">("tree");
  const [zoomScale, setZoomScale] = useState<number>(1.0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError(null);
      roster
        .list(user?.companyCode ?? "", branchId)
        .then((emps) => {
          if (active) setEmpList(emps);
        })
        .catch((e) => {
          if (active) setError(messageOf(e));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [revision, user?.companyCode, branchId])
  );

  const tree = useMemo(() => buildTree(empList), [empList]);

  const highlighted = useMemo<Set<string> | null>(() => {
    if (!search.trim()) return null;
    return flattenSearchMatches(tree, search.toLowerCase());
  }, [tree, search]);

  const managerName = useMemo(() => {
    if (!selected?.parentId) return undefined;
    return empList.find((e) => e.uid === selected.parentId)?.displayName;
  }, [selected, empList]);

  function toggle(uid: string) {
    setCollapsed((prev) => {
      const n = new Set(prev);
      n.has(uid) ? n.delete(uid) : n.add(uid);
      return n;
    });
  }

  function expandAll() {
    setCollapsed(new Set());
  }

  function collapseAll() {
    const uids = new Set<string>();
    function walk(nodes: TreeNode[]) {
      nodes.forEach((n) => {
        if (n.children.length) {
          uids.add(n.emp.uid);
          walk(n.children);
        }
      });
    }
    walk(tree);
    setCollapsed(uids);
  }

  function zoomIn() {
    setZoomScale((z) => Math.min(1.3, Number((z + 0.15).toFixed(2))));
  }

  function zoomOut() {
    setZoomScale((z) => Math.max(0.6, Number((z - 0.15).toFixed(2))));
  }

  function zoomReset() {
    setZoomScale(1.0);
  }

  const Header = () => (
    <View style={s.header}>
      <Pressable onPress={() => router.back()} style={s.iconBtn}>
        <Text style={{ fontSize: 18, color: "#0f172a", fontWeight: "700" }}>{"<"}</Text>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={s.title}>Sơ đồ tổ chức</Text>
        {!loading && !error && (
          <Text style={s.subtitle}>
            {empList.length} nhân sự · {selectedBranch?.name || "Tất cả chi nhánh"}
          </Text>
        )}
      </View>

      {/* View Mode Toggle: Cây vs Danh Sách */}
      <View style={s.viewToggleContainer}>
        <Pressable
          style={[s.toggleTab, viewMode === "tree" && s.toggleTabActive]}
          onPress={() => setViewMode("tree")}
        >
          <Text
            style={[
              s.toggleTabTxt,
              viewMode === "tree" ? s.toggleTabTxtActive : s.toggleTabTxtInactive,
            ]}
          >
            🌳 Cây
          </Text>
        </Pressable>
        <Pressable
          style={[s.toggleTab, viewMode === "list" && s.toggleTabActive]}
          onPress={() => setViewMode("list")}
        >
          <Text
            style={[
              s.toggleTabTxt,
              viewMode === "list" ? s.toggleTabTxtActive : s.toggleTabTxtInactive,
            ]}
          >
            📋 Bảng
          </Text>
        </Pressable>
      </View>

      <Pressable style={s.iconBtn} onPress={() => setRevision((v) => v + 1)}>
        <Text style={{ fontSize: 17 }}>↺</Text>
      </Pressable>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView edges={["top"]} style={s.root}>
        <Header />
        <View style={s.centerBox}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={s.loadingText}>Đang tải dữ liệu sơ đồ tổ chức…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView edges={["top"]} style={s.root}>
        <Header />
        <View style={s.centerBox}>
          <Text style={s.errorText}>{error}</Text>
          <Pressable style={s.retryBtn} onPress={() => setRevision((v) => v + 1)}>
            <Text style={s.retryTxt}>Thử lại</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={s.root}>
      <Header />

      {/* Control Toolbar: Search + Quick Expand/Collapse + Zoom */}
      <View style={s.toolbar}>
        <View style={s.searchBox}>
          <Text style={{ color: "#94a3b8", fontSize: 13, marginRight: 6 }}>🔍</Text>
          <TextInput
            style={s.searchInput}
            placeholder="Tìm tên, chức danh, phòng ban…"
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
          />
          {!!search && (
            <Pressable onPress={() => setSearch("")} hitSlop={6}>
              <Text style={{ color: "#94a3b8", fontWeight: "700", paddingHorizontal: 4 }}>✕</Text>
            </Pressable>
          )}
        </View>

        {viewMode === "tree" && (
          <View style={s.treeToolRow}>
            <View style={s.expandGroup}>
              <Pressable style={s.toolBtn} onPress={expandAll}>
                <Text style={s.toolBtnTxt}>Mở hết</Text>
              </Pressable>
              <Pressable style={s.toolBtn} onPress={collapseAll}>
                <Text style={s.toolBtnTxt}>Thu gọn</Text>
              </Pressable>
            </View>

            <View style={s.zoomGroup}>
              <Pressable style={s.zoomBtn} onPress={zoomOut}>
                <Text style={s.zoomBtnTxt}>−</Text>
              </Pressable>
              <Pressable style={s.zoomLabelBtn} onPress={zoomReset}>
                <Text style={s.zoomLabelTxt}>{Math.round(zoomScale * 100)}%</Text>
              </Pressable>
              <Pressable style={s.zoomBtn} onPress={zoomIn}>
                <Text style={s.zoomBtnTxt}>+</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* Main Content Area */}
      {viewMode === "list" ? (
        <OrgListView emps={empList} onSelect={setSelected} highlighted={highlighted} />
      ) : (
        /* 2D Scrollable Interactive Tree Canvas */
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.verticalScroll}
          showsVerticalScrollIndicator={true}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={true}
            contentContainerStyle={s.horizontalScroll}
          >
            {tree.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={{ fontSize: 36, marginBottom: 8 }}>👥</Text>
                <Text style={s.emptyTitle}>Chưa có dữ liệu cơ cấu nhân sự</Text>
                <Text style={s.emptySub}>Vui lòng kiểm tra phân quyền hoặc danh sách nhân viên</Text>
              </View>
            ) : (
              <View
                style={[
                  s.treeCanvas,
                  {
                    transform: [{ scale: zoomScale }],
                  },
                ]}
              >
                <View style={s.rootRow}>
                  {tree.map((rootNode) => (
                    <TreeBranchView
                      key={rootNode.emp.uid}
                      node={rootNode}
                      onSelect={setSelected}
                      collapsed={collapsed}
                      toggleCollapse={toggle}
                      highlighted={highlighted}
                    />
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        </ScrollView>
      )}

      {/* Employee Profile Details Modal */}
      <ProfileModal
        emp={selected}
        managerName={managerName}
        onClose={() => setSelected(null)}
      />
    </SafeAreaView>
  );
}

/* ==========================================================================
   7. STYLESHEET
   ========================================================================== */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 17, fontWeight: "800", color: "#0f172a", letterSpacing: -0.3 },
  subtitle: { fontSize: 11, color: "#64748b", marginTop: 1 },

  viewToggleContainer: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    padding: 2,
  },
  toggleTab: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  toggleTabActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  toggleTabTxt: { fontSize: 11, fontWeight: "700" },
  toggleTabTxtActive: { color: "#4f46e5" },
  toggleTabTxtInactive: { color: "#64748b" },

  toolbar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 8,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 38,
  },
  searchInput: { flex: 1, fontSize: 13, color: "#0f172a", paddingVertical: 0 },

  treeToolRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  expandGroup: {
    flexDirection: "row",
    gap: 6,
  },
  toolBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  toolBtnTxt: { fontSize: 11, fontWeight: "700", color: "#475569" },

  zoomGroup: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  zoomBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  zoomBtnTxt: { fontSize: 14, fontWeight: "800", color: "#475569" },
  zoomLabelBtn: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  zoomLabelTxt: { fontSize: 10, fontWeight: "700", color: "#475569" },

  /* 2D Tree Canvas */
  verticalScroll: { flexGrow: 1 },
  horizontalScroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    paddingVertical: 24,
  },
  treeCanvas: {
    alignItems: "center",
  },
  rootRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 32,
  },

  /* Recursive Tree Branch Layout */
  branchCol: {
    alignItems: "center",
  },
  childrenContainer: {
    alignItems: "center",
  },
  childrenRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  childWrapper: {
    alignItems: "center",
    paddingHorizontal: CARD_MARGIN,
    position: "relative",
  },

  /* Connector Lines */
  stemLine: {
    width: 2,
    height: 22,
    backgroundColor: "#cbd5e1",
    alignSelf: "center",
  },
  connectorBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    flexDirection: "row",
  },
  connectorHalf: {
    width: "50%",
    height: 2,
  },
  connectorBorder: {
    borderTopWidth: 2,
    borderTopColor: "#cbd5e1",
  },

  /* Smart Employee Card (Chuẩn Web) */
  card: {
    width: CARD_WIDTH,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderTopWidth: 4,
    padding: 10,
    shadowColor: "#0f172a",
    shadowOpacity: 0.07,
    shadowRadius: 5,
    elevation: 2,
    position: "relative",
  },
  cardHighlighted: {
    borderColor: "#4f46e5",
    shadowColor: "#4f46e5",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  cardDimmed: {
    opacity: 0.25,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  leaderBadge: {
    backgroundColor: "#f59e0b",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  leaderText: {
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  leaderBadgeLarge: {
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fde68a",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  leaderTextLarge: {
    color: "#b45309",
    fontSize: 10,
    fontWeight: "800",
  },
  catBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  catBadgeText: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 1,
    borderColor: "#ffffff",
  },
  deptContainer: {
    minHeight: 28,
    justifyContent: "center",
    marginBottom: 6,
  },
  deptName: {
    fontSize: 11,
    fontWeight: "800",
    color: "#1e293b",
    lineHeight: 14,
  },
  cardBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  cardMeta: {
    flex: 1,
    marginLeft: 6,
  },
  roleText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
  },
  nameText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 1,
  },

  /* Bottom toggle badge */
  toggleBadge: {
    position: "absolute",
    bottom: -11,
    alignSelf: "center",
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 10,
    borderWidth: 1.5,
    zIndex: 20,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleText: {
    fontSize: 9,
    fontWeight: "900",
  },

  /* List Mode Styles */
  listContainer: {
    padding: 12,
    gap: 8,
  },
  listCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderLeftWidth: 4,
    padding: 12,
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  listEmpName: { fontSize: 13, fontWeight: "800", color: "#0f172a" },
  listEmpRole: { fontSize: 11, fontWeight: "600", color: "#64748b", marginTop: 2 },
  listEmpDept: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  listCallBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },

  /* Modal Details */
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 12,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e2e8f0",
    alignSelf: "center",
    marginBottom: 16,
  },
  mName: { fontSize: 18, fontWeight: "800", color: "#0f172a", marginTop: 10, textAlign: "center" },
  mSub: { fontSize: 13, color: "#64748b", marginTop: 3, textAlign: "center" },
  pill: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pillTxt: { fontSize: 9, fontWeight: "800" },
  infoBlock: {
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginVertical: 14,
    overflow: "hidden",
  },
  iRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    gap: 10,
  },
  iIco: { fontSize: 15, width: 22, textAlign: "center" },
  iLbl: { fontSize: 12, color: "#64748b", width: 78, fontWeight: "600" },
  iVal: { flex: 1, fontSize: 13, color: "#0f172a", fontWeight: "600" },
  actionRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingVertical: 12,
    gap: 5,
  },
  actionIco: { fontSize: 20 },
  actionLbl: { fontSize: 12, fontWeight: "700", color: "#475569" },

  /* Center / Empty states */
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: { marginTop: 12, color: "#64748b", fontSize: 14 },
  errorText: { color: "#e11d48", fontWeight: "700", fontSize: 15, textAlign: "center" },
  retryBtn: {
    marginTop: 18,
    backgroundColor: "#4f46e5",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryTxt: { color: "#ffffff", fontWeight: "700", fontSize: 14 },
  emptyBox: { alignItems: "center", paddingVertical: 48 },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: "#475569" },
  emptySub: { fontSize: 12, color: "#94a3b8", marginTop: 4 },
});
