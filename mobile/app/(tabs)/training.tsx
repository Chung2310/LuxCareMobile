import { useAppAlert } from "../../src/components/AppAlert";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  AlertCircle,
  Award,
  BookOpen,
  CheckCheck,
  CheckCircle2,
  Circle,
  CircleDot,
  Clock,
  Code2,
  ExternalLink,
  FileText,
  GraduationCap,
  HeartHandshake,
  Lock,
  Pencil,
  Play,
  Plus,
  RotateCw,
  Search,
  Trash2,
  TrendingUp,
  User,
  UserPlus,
  Users,
  Video,
  X,
  XCircle,
  Zap,
} from "lucide-react-native";
import type { Lesson, QuizQuestion, TrainingCourse, TrainingEnrollment } from "../../../src/types/hr";
import { roster, training } from "../../src/api/services";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { trainingAccess } from "../../src/features/training/access";
import { EmptyState, ErrorText, Loading, Page } from "../../src/ui";

const CATEGORIES = ["Tất cả", "Văn hóa", "Kỹ thuật", "Kinh doanh", "Hướng dẫn nhân viên mới"];

function nextStep(course: TrainingCourse, enrollment: TrainingEnrollment) {
  const lessons = course.lessons || [];
  const completed = enrollment.completedLessons || [];
  const nextLesson = lessons.findIndex((_, index) => !completed.includes(`lesson_${index}`));
  if (nextLesson >= 0) return nextLesson;
  if (course.quizzes?.length && !enrollment.quizPassed) return lessons.length;
  return -1;
}

function CourseIcon({ course, size = 22, color = "#7c3aed" }: { course: TrainingCourse; size?: number; color?: string }) {
  const iconKey = (course.icon || "").toLowerCase().trim();
  if (iconKey === "code" || iconKey.includes("kỹ thuật") || iconKey.includes("tech")) {
    return <Code2 size={size} color={color} />;
  }
  if (iconKey === "business" || iconKey.includes("kinh doanh") || iconKey.includes("sales")) {
    return <TrendingUp size={size} color={color} />;
  }
  if (iconKey === "culture" || iconKey.includes("văn hóa")) {
    return <HeartHandshake size={size} color={color} />;
  }
  if (iconKey === "onboarding" || iconKey.includes("hướng dẫn") || iconKey.includes("nhân viên mới")) {
    return <UserPlus size={size} color={color} />;
  }
  if (iconKey === "award" || iconKey === "certificate") {
    return <Award size={size} color={color} />;
  }
  if (iconKey === "book" || iconKey === "lesson") {
    return <BookOpen size={size} color={color} />;
  }

  // Fallback based on category
  const cat = (course.category || "").toLowerCase();
  if (cat.includes("kỹ thuật") || cat.includes("tech")) {
    return <Code2 size={size} color={color} />;
  }
  if (cat.includes("kinh doanh") || cat.includes("sales") || cat.includes("marketing")) {
    return <TrendingUp size={size} color={color} />;
  }
  if (cat.includes("văn hóa") || cat.includes("culture")) {
    return <HeartHandshake size={size} color={color} />;
  }
  if (cat.includes("hướng dẫn") || cat.includes("nhân viên mới") || cat.includes("onboarding")) {
    return <UserPlus size={size} color={color} />;
  }

  return <GraduationCap size={size} color={color} />;
}

export default function TrainingPage() {
  const { showAlert, alertView } = useAppAlert();
  const { user, selectedBranch } = useSession();
  const access = trainingAccess(user);

  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [enrollments, setEnrollments] = useState<TrainingEnrollment[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tất cả");
  const [statusFilter, setStatusFilter] = useState<"all" | "in_progress" | "completed" | "required">("all");

  // Editing & Learning states
  const [editing, setEditing] = useState<TrainingCourse | "new" | null>(null);
  const [activeCourse, setActiveCourse] = useState<TrainingCourse | null>(null);
  const [activeStep, setActiveStep] = useState(-1);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizErrors, setQuizErrors] = useState<boolean[]>([]);
  const [busyCourseId, setBusyCourseId] = useState<string | null>(null);

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (!access.read || !user?.companyCode) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const [courseList, enrollmentList] = await Promise.all([
          training.listCourses(user.companyCode),
          training.listEnrollments({ companyCode: user.companyCode, uid: user.uid }),
        ]);
        setCourses(courseList);
        setEnrollments(enrollmentList);
      } catch (loadError) {
        setError(messageOf(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [access.read, user?.companyCode, user?.uid],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setError(null);
      if (!access.read || !user?.companyCode) {
        setLoading(false);
        return;
      }
      setLoading(true);
      Promise.all([
        training.listCourses(user.companyCode),
        training.listEnrollments({ companyCode: user.companyCode, uid: user.uid }),
      ])
        .then(([courseList, enrollmentList]) => {
          if (!active) return;
          setCourses(courseList);
          setEnrollments(enrollmentList);
        })
        .catch((loadError) => {
          if (active) setError(messageOf(loadError));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [access.read, user?.companyCode, user?.uid, selectedBranch?._id, revision]),
  );

  const openCourse = async (course: TrainingCourse) => {
    if (!user?.companyCode || busyCourseId) return;
    setBusyCourseId(course.id);
    try {
      let enrollment = enrollments.find((item) => item.courseId === course.id);
      if (!enrollment) {
        const now = new Date().toISOString();
        enrollment = await training.enroll({
          courseId: course.id,
          courseTitle: course.title,
          uid: user.uid,
          userName: user.displayName || user.email || "Nhân viên",
          companyCode: user.companyCode,
          progress: 0,
          status: "in_progress",
          startedAt: now,
          completedLessons: [],
          quizPassed: false,
        });
        setEnrollments((current) => [...current, enrollment!]);
        const enrolledCount = (course.enrolledCount || 0) + 1;
        setCourses((current) =>
          current.map((item) => (item.id === course.id ? { ...item, enrolledCount } : item)),
        );
        void training.updateCourse(course.id, { enrolledCount }).catch(() => {});
      }
      setActiveCourse(course);
      setActiveStep(nextStep(course, enrollment));
      setAnswers({});
      setQuizSubmitted(false);
      setQuizErrors([]);
    } catch (openError) {
      showAlert("Không thể bắt đầu khóa học", messageOf(openError), undefined, "error");
    } finally {
      setBusyCourseId(null);
    }
  };

  const updateEnrollment = async (
    enrollment: TrainingEnrollment,
    patch: Parameters<typeof training.updateEnrollment>[1],
  ) => {
    const updated = await training.updateEnrollment(enrollment.id, patch);
    setEnrollments((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    return updated;
  };

  const markLessonComplete = async () => {
    if (!activeCourse || activeStep < 0 || activeStep >= (activeCourse.lessons || []).length) return;
    const enrollment = enrollments.find((item) => item.courseId === activeCourse.id);
    if (!enrollment) return;
    const completed = enrollment.completedLessons || [];
    const key = `lesson_${activeStep}`;
    if (completed.includes(key)) {
      setActiveStep(
        activeStep + 1 < (activeCourse.lessons || []).length
          ? activeStep + 1
          : activeCourse.lessons?.length || -1,
      );
      return;
    }
    const completedLessons = [...completed, key];
    const totalItems = (activeCourse.lessons || []).length + (activeCourse.quizzes?.length ? 1 : 0);
    const progress = Math.round(
      ((completedLessons.length + (enrollment.quizPassed ? 1 : 0)) / Math.max(totalItems, 1)) * 100,
    );
    const completedNow = progress >= 100;
    try {
      await updateEnrollment(enrollment, {
        completedLessons,
        progress,
        status: completedNow ? "completed" : "in_progress",
        ...(completedNow ? { completedAt: new Date().toISOString() } : {}),
      });
      if (completedNow) {
        showAlert("Chúc mừng", `Bạn đã hoàn thành xuất sắc khóa học “${activeCourse.title}”.`, undefined, "success");
        setActiveCourse(null);
      } else if (activeStep + 1 < (activeCourse.lessons || []).length) {
        setActiveStep(activeStep + 1);
      } else {
        setActiveStep(activeCourse.lessons?.length || -1);
      }
    } catch (saveError) {
      showAlert("Không thể lưu tiến độ", messageOf(saveError), undefined, "error");
    }
  };

  const submitQuiz = async () => {
    if (!activeCourse) return;
    const quizzes = activeCourse.quizzes || [];
    const enrollment = enrollments.find((item) => item.courseId === activeCourse.id);
    if (!enrollment || !quizzes.length) return;
    if (quizzes.some((_, index) => answers[index] === undefined)) {
      showAlert("Chưa hoàn tất", "Vui lòng trả lời tất cả các câu hỏi trước khi nộp bài.", undefined, "error");
      return;
    }
    const errors = quizzes.map((quiz, index) => answers[index] !== quiz.correctOptionIndex);
    setQuizSubmitted(true);
    setQuizErrors(errors);
    if (errors.some(Boolean)) return;
    const totalItems = (activeCourse.lessons || []).length + 1;
    const progress = Math.round(
      (((enrollment.completedLessons || []).length + 1) / Math.max(totalItems, 1)) * 100,
    );
    try {
      await updateEnrollment(enrollment, {
        quizPassed: true,
        progress,
        status: progress >= 100 ? "completed" : "in_progress",
        ...(progress >= 100 ? { completedAt: new Date().toISOString() } : {}),
      });
      showAlert("Đạt sát hạch", `Chúc mừng! Bạn đã hoàn thành phần kiểm tra của “${activeCourse.title}”.`, [
        { text: "Đóng", onPress: () => setActiveCourse(null) },
      ], "success");
    } catch (saveError) {
      showAlert("Không thể lưu kết quả", messageOf(saveError), undefined, "error");
    }
  };

  const completeDirectly = async () => {
    if (!activeCourse) return;
    const enrollment = enrollments.find((item) => item.courseId === activeCourse.id);
    if (!enrollment) return;
    try {
      await updateEnrollment(enrollment, {
        progress: 100,
        status: "completed",
        completedAt: new Date().toISOString(),
      });
      setActiveCourse(null);
    } catch (saveError) {
      showAlert("Không thể hoàn thành khóa học", messageOf(saveError), undefined, "error");
    }
  };

  const deleteCourse = (course: TrainingCourse) => {
    showAlert("Xóa khóa học?", `Bạn có chắc muốn xóa “${course.title}”? Thao tác này không thể hoàn tác.`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa khóa học",
        style: "destructive",
        onPress: () => {
          void training
            .removeCourse(course.id)
            .then(() => setRevision((value) => value + 1))
            .catch((deleteError) => {
              showAlert("Không thể xóa khóa học", messageOf(deleteError), undefined, "error");
            });
        },
      },
    ]);
  };

  // Stats calculation
  const stats = useMemo(() => {
    const inProgressCount = enrollments.filter((item) => item.status === "in_progress").length;
    const completedCount = enrollments.filter((item) => item.status === "completed").length;
    const requiredCount = courses.filter((item) => item.isRequired).length;
    return {
      total: courses.length,
      inProgress: inProgressCount,
      completed: completedCount,
      required: requiredCount,
    };
  }, [courses, enrollments]);

  // Filtered courses
  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      // Category filter
      if (selectedCategory !== "Tất cả" && course.category !== selectedCategory) {
        return false;
      }
      // Status filter
      const enrollment = enrollments.find((e) => e.courseId === course.id);
      if (statusFilter === "in_progress" && enrollment?.status !== "in_progress") {
        return false;
      }
      if (statusFilter === "completed" && enrollment?.status !== "completed") {
        return false;
      }
      if (statusFilter === "required" && !course.isRequired) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = course.title?.toLowerCase().includes(q);
        const matchDesc = course.description?.toLowerCase().includes(q);
        const matchInstructor = course.instructor?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchInstructor) return false;
      }
      return true;
    });
  }, [courses, enrollments, selectedCategory, statusFilter, searchQuery]);

  if (!access.read) {
    return (
      <Page title="Đào tạo">
        <View style={uiStyles.emptyStateContainer}>
          <Lock size={40} color="#94a3b8" />
          <Text style={uiStyles.emptyStateTitle}>Không có quyền truy cập</Text>
          <Text style={uiStyles.emptyStateDesc}>
            Cần phân hệ Nhân sự và mã doanh nghiệp hợp lệ để sử dụng chức năng Đào tạo nội bộ.
          </Text>
        </View>
        {!activeCourse && alertView}
      </Page>
    );
  }

  return (
    <>
      <SafeAreaView edges={["top"]} style={uiStyles.container}>
        <ScrollView
          style={uiStyles.scroll}
          contentContainerStyle={uiStyles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                void loadData(true);
                setRevision((v) => v + 1);
              }}
              colors={["#7c3aed"]}
              tintColor="#7c3aed"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Top Header */}
          <View style={uiStyles.headerContainer}>
            <View style={uiStyles.headerLeft}>
              <Text style={uiStyles.headerTitle}>Đào tạo nội bộ</Text>
              <View style={uiStyles.branchRow}>
                <View style={uiStyles.branchDot} />
                <Text style={uiStyles.branchName}>
                  {selectedBranch?.name || "LuxCare Education"} · {courses.length} khóa học
                </Text>
              </View>
            </View>

            <View style={uiStyles.headerRight}>
              <TouchableOpacity
                style={uiStyles.refreshBtn}
                onPress={() => setRevision((v) => v + 1)}
                disabled={loading}
                activeOpacity={0.7}
              >
                <RotateCw size={17} color="#475569" />
              </TouchableOpacity>

              {access.manage && (
                <TouchableOpacity
                  style={uiStyles.createBtn}
                  onPress={() => setEditing("new")}
                  activeOpacity={0.8}
                >
                  <Plus size={18} color="#ffffff" />
                  <Text style={uiStyles.createBtnText}>Tạo khóa</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Quick Metrics Banner */}
          <View style={uiStyles.summaryRow}>
            <TouchableOpacity
              style={[
                uiStyles.summaryCard,
                { borderLeftColor: "#7c3aed" },
                statusFilter === "all" && uiStyles.summaryCardActive,
              ]}
              onPress={() => setStatusFilter("all")}
              activeOpacity={0.7}
            >
              <Text style={[uiStyles.summaryValue, { color: "#7c3aed" }]}>{stats.total}</Text>
              <Text style={uiStyles.summaryLabel}>Khóa học</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                uiStyles.summaryCard,
                { borderLeftColor: "#2563eb" },
                statusFilter === "in_progress" && uiStyles.summaryCardActive,
              ]}
              onPress={() => setStatusFilter(statusFilter === "in_progress" ? "all" : "in_progress")}
              activeOpacity={0.7}
            >
              <Text style={[uiStyles.summaryValue, { color: "#2563eb" }]}>{stats.inProgress}</Text>
              <Text style={uiStyles.summaryLabel}>Đang học</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                uiStyles.summaryCard,
                { borderLeftColor: "#059669" },
                statusFilter === "completed" && uiStyles.summaryCardActive,
              ]}
              onPress={() => setStatusFilter(statusFilter === "completed" ? "all" : "completed")}
              activeOpacity={0.7}
            >
              <Text style={[uiStyles.summaryValue, { color: "#059669" }]}>{stats.completed}</Text>
              <Text style={uiStyles.summaryLabel}>Hoàn thành</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                uiStyles.summaryCard,
                { borderLeftColor: "#e11d48" },
                statusFilter === "required" && uiStyles.summaryCardActive,
              ]}
              onPress={() => setStatusFilter(statusFilter === "required" ? "all" : "required")}
              activeOpacity={0.7}
            >
              <Text style={[uiStyles.summaryValue, { color: "#e11d48" }]}>{stats.required}</Text>
              <Text style={uiStyles.summaryLabel}>Bắt buộc</Text>
            </TouchableOpacity>
          </View>

          {/* Search Box */}
          <View style={uiStyles.searchContainer}>
            <Search size={17} color="#64748b" style={{ marginRight: 8 }} />
            <TextInput
              style={uiStyles.searchInput}
              placeholder="Tìm theo tên khóa học, giảng viên, bài học..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery("")}
                style={{ padding: 4 }}
                activeOpacity={0.6}
              >
                <XCircle size={17} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Category Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={uiStyles.filterChipsRow}
          >
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[uiStyles.filterChip, isSelected && uiStyles.filterChipActive]}
                  onPress={() => setSelectedCategory(cat)}
                  activeOpacity={0.75}
                >
                  <Text style={[uiStyles.filterChipText, isSelected && uiStyles.filterChipTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Error Banner */}
          <ErrorText message={error} />

          {/* Loading Indicator */}
          {loading && !courses.length && <Loading />}

          {/* Empty State */}
          {!loading && !error && filteredCourses.length === 0 && (
            <View style={uiStyles.emptyStateContainer}>
              <GraduationCap size={44} color="#7c3aed" style={{ marginBottom: 8 }} />
              <Text style={uiStyles.emptyStateTitle}>Không tìm thấy khóa học</Text>
              <Text style={uiStyles.emptyStateDesc}>
                {searchQuery
                  ? `Không có khóa học nào khớp với từ khóa "${searchQuery}".`
                  : "Chưa có khóa học nào trong danh mục này."}
              </Text>
              {(searchQuery || selectedCategory !== "Tất cả" || statusFilter !== "all") && (
                <TouchableOpacity
                  style={uiStyles.resetFilterBtn}
                  onPress={() => {
                    setSearchQuery("");
                    setSelectedCategory("Tất cả");
                    setStatusFilter("all");
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={uiStyles.resetFilterText}>Xóa bộ lọc</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Course Cards */}
          {filteredCourses.map((course) => {
            const enrollment = enrollments.find((item) => item.courseId === course.id);
            const completed = enrollment?.status === "completed";
            const inProgress = enrollment?.status === "in_progress";
            const canEdit = access.manage && (course.creatorUid === user?.uid || user?.role === "admin");
            const lessonsCount = (course.lessons || []).length;
            const quizzesCount = (course.quizzes || []).length;

            return (
              <View key={course.id} style={uiStyles.courseCard}>
                {/* Header Row */}
                <View style={uiStyles.cardTopRow}>
                  <View style={uiStyles.courseIconBox}>
                    <CourseIcon course={course} size={22} color="#7c3aed" />
                  </View>

                  <View style={uiStyles.courseHeaderInfo}>
                    <View style={uiStyles.badgeGroup}>
                      <View style={uiStyles.categoryBadge}>
                        <Text style={uiStyles.categoryBadgeText}>{course.category || "Đào tạo"}</Text>
                      </View>
                      {course.isRequired && (
                        <View style={uiStyles.requiredBadge}>
                          <Text style={uiStyles.requiredBadgeText}>BẮT BUỘC</Text>
                        </View>
                      )}
                    </View>
                    <Text style={uiStyles.courseTitle} numberOfLines={2}>
                      {course.title}
                    </Text>
                  </View>
                </View>

                {/* Description */}
                <Text style={uiStyles.courseDesc} numberOfLines={2}>
                  {course.description || "Khóa học chuyên môn nâng cao kỹ năng và tiêu chuẩn LuxCare."}
                </Text>

                {/* 2x2 Metadata Grid */}
                <View style={uiStyles.metaGrid}>
                  <View style={uiStyles.metaItem}>
                    <Clock size={13} color="#64748b" />
                    <Text style={uiStyles.metaItemText}>{course.duration || "Tự do"}</Text>
                  </View>
                  <View style={uiStyles.metaItem}>
                    <User size={13} color="#64748b" />
                    <Text style={uiStyles.metaItemText} numberOfLines={1}>
                      {course.instructor || "LuxCare Academy"}
                    </Text>
                  </View>
                  <View style={uiStyles.metaItem}>
                    <BookOpen size={13} color="#64748b" />
                    <Text style={uiStyles.metaItemText}>
                      {lessonsCount} bài{quizzesCount ? ` · ${quizzesCount} câu hỏi` : ""}
                    </Text>
                  </View>
                  <View style={uiStyles.metaItem}>
                    <Users size={13} color="#64748b" />
                    <Text style={uiStyles.metaItemText}>
                      {course.enrolledCount || 0} học viên
                    </Text>
                  </View>
                </View>

                {/* Progress Bar (if enrolled) */}
                {enrollment && (
                  <View style={uiStyles.progressSection}>
                    <View style={uiStyles.progressHeader}>
                      <Text style={uiStyles.progressLabel}>TIẾN ĐỘ HỌC TẬP</Text>
                      <View style={uiStyles.progressPercentRow}>
                        {completed ? (
                          <View style={uiStyles.completedBadge}>
                            <CheckCircle2 size={13} color="#059669" />
                            <Text style={uiStyles.completedBadgeText}>Đã hoàn thành</Text>
                          </View>
                        ) : (
                          <Text style={uiStyles.progressPercentText}>{enrollment.progress}%</Text>
                        )}
                      </View>
                    </View>
                    <View style={uiStyles.progressTrack}>
                      <View
                        style={[
                          uiStyles.progressFill,
                          {
                            width: `${Math.min(Math.max(enrollment.progress, 0), 100)}%`,
                            backgroundColor: completed ? "#10b981" : "#7c3aed",
                          },
                        ]}
                      />
                    </View>
                  </View>
                )}

                {/* Action Buttons */}
                <View style={uiStyles.cardActionRow}>
                  <TouchableOpacity
                    style={[
                      uiStyles.primaryStudyBtn,
                      completed && uiStyles.completedStudyBtn,
                      busyCourseId === course.id && { opacity: 0.6 },
                    ]}
                    onPress={() => void openCourse(course)}
                    disabled={busyCourseId === course.id}
                    activeOpacity={0.8}
                  >
                    {completed ? (
                      <RotateCw size={15} color="#ffffff" />
                    ) : inProgress ? (
                      <Play size={15} color="#ffffff" />
                    ) : (
                      <Zap size={15} color="#ffffff" />
                    )}
                    <Text style={uiStyles.primaryStudyBtnText}>
                      {completed
                        ? "Xem lại khóa học"
                        : inProgress
                          ? "Tiếp tục bài học"
                          : "Bắt đầu học ngay"}
                    </Text>
                  </TouchableOpacity>

                  {canEdit && (
                    <TouchableOpacity
                      style={uiStyles.iconActionBtn}
                      onPress={() => setEditing(course)}
                      activeOpacity={0.7}
                    >
                      <Pencil size={16} color="#475569" />
                    </TouchableOpacity>
                  )}

                  {canEdit && (
                    <TouchableOpacity
                      style={[uiStyles.iconActionBtn, { borderColor: "#fecaca", backgroundColor: "#fff1f2" }]}
                      onPress={() => deleteCourse(course)}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={16} color="#dc2626" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>

      {/* Edit Course Modal */}
      <Modal visible={editing !== null} animationType="slide" onRequestClose={() => setEditing(null)}>
        <SafeAreaView style={uiStyles.modalSafeArea} edges={["top", "bottom"]}>
          {editing && user?.companyCode && (
            <CourseForm
              course={editing === "new" ? undefined : editing}
              companyCode={user.companyCode}
              userName={user.displayName || user.email || "Quản trị viên"}
              onClose={() => setEditing(null)}
              onSaved={() => {
                setEditing(null);
                setRevision((value) => value + 1);
              }}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* Interactive Study / Quiz Modal */}
      <StudyModal
        notification={alertView}
        course={activeCourse}
        enrollment={activeCourse ? enrollments.find((item) => item.courseId === activeCourse.id) : undefined}
        step={activeStep}
        answers={answers}
        quizSubmitted={quizSubmitted}
        quizErrors={quizErrors}
        onClose={() => setActiveCourse(null)}
        onSelectAnswer={(question, answer) => {
          setAnswers((current) => ({ ...current, [question]: answer }));
          setQuizSubmitted(false);
          setQuizErrors([]);
        }}
        onCompleteLesson={() => void markLessonComplete()}
        onSubmitQuiz={() => void submitQuiz()}
        onCompleteDirectly={() => void completeDirectly()}
        onOpenLink={(url) => void openLink(url, showAlert)}
      />
      {!activeCourse && alertView}
    </>
  );
}

// -------------------------------------------------------------
// Study Modal Subcomponent
// -------------------------------------------------------------
function StudyModal({
  notification,
  course,
  enrollment,
  step,
  answers,
  quizSubmitted,
  quizErrors,
  onClose,
  onSelectAnswer,
  onCompleteLesson,
  onSubmitQuiz,
  onCompleteDirectly,
  onOpenLink,
}: {
  notification: ReactNode;
  course: TrainingCourse | null;
  enrollment?: TrainingEnrollment;
  step: number;
  answers: Record<number, number>;
  quizSubmitted: boolean;
  quizErrors: boolean[];
  onClose: () => void;
  onSelectAnswer: (question: number, answer: number) => void;
  onCompleteLesson: () => void;
  onSubmitQuiz: () => void;
  onCompleteDirectly: () => void;
  onOpenLink: (url: string) => void;
}) {
  const lessons = course?.lessons || [];
  const quizzes = course?.quizzes || [];
  const lesson = step >= 0 && step < lessons.length ? lessons[step] : undefined;
  const isQuiz = !!course && step >= lessons.length && quizzes.length > 0;

  if (!course) return null;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={studyStyles.container} edges={["top", "bottom"]}>
        {/* Top Header */}
        <View style={studyStyles.header}>
          <View style={{ flex: 1 }}>
            <View style={studyStyles.headerBadgeRow}>
              <Text style={studyStyles.categoryText}>{course.category || "Khóa học"}</Text>
              {lesson ? (
                <Text style={studyStyles.stepIndicatorText}>
                  Bài {step + 1} / {lessons.length}
                </Text>
              ) : isQuiz ? (
                <Text style={studyStyles.stepIndicatorText}>Bài kiểm tra</Text>
              ) : null}
            </View>
            <Text style={studyStyles.headerTitle} numberOfLines={2}>
              {course.title}
            </Text>
          </View>
          <TouchableOpacity style={studyStyles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <X size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={studyStyles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Progress Overview */}
          {enrollment && (
            <View style={studyStyles.progressCard}>
              <View style={studyStyles.progressCardRow}>
                <Text style={studyStyles.progressCardLabel}>Tiến độ hoàn thành</Text>
                <Text style={studyStyles.progressCardValue}>{enrollment.progress}%</Text>
              </View>
              <View style={uiStyles.progressTrack}>
                <View
                  style={[
                    uiStyles.progressFill,
                    {
                      width: `${Math.min(Math.max(enrollment.progress, 0), 100)}%`,
                      backgroundColor: enrollment.status === "completed" ? "#10b981" : "#7c3aed",
                    },
                  ]}
                />
              </View>
            </View>
          )}

          {/* Lesson View */}
          {lesson && (
            <View style={studyStyles.contentCard}>
              <View style={studyStyles.lessonTypeBadge}>
                {lesson.type === "video" || lesson.type === "youtube" ? (
                  <Video size={14} color="#7c3aed" />
                ) : (
                  <FileText size={14} color="#7c3aed" />
                )}
                <Text style={studyStyles.lessonTypeText}>
                  {lesson.type === "video" || lesson.type === "youtube" ? "Video bài giảng" : "Tài liệu lý thuyết"}
                </Text>
              </View>

              <Text style={studyStyles.lessonTitle}>{lesson.title || "Nội dung bài học"}</Text>

              {Boolean(lesson.content) && (
                <View style={studyStyles.lessonBody}>
                  <Text style={studyStyles.lessonBodyText}>{lesson.content}</Text>
                </View>
              )}

              {Boolean(lesson.url) && (
                <TouchableOpacity
                  style={studyStyles.externalLinkBtn}
                  onPress={() => onOpenLink(lesson.url)}
                  activeOpacity={0.8}
                >
                  <ExternalLink size={17} color="#4f46e5" />
                  <Text style={studyStyles.externalLinkText}>Mở tài liệu / Video đính kèm</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={studyStyles.completeLessonBtn}
                onPress={onCompleteLesson}
                activeOpacity={0.8}
              >
                <CheckCircle2 size={18} color="#ffffff" />
                <Text style={studyStyles.completeLessonBtnText}>
                  {enrollment?.completedLessons?.includes(`lesson_${step}`)
                    ? "Đã học · Sang bài tiếp theo"
                    : "Đánh dấu đã học xong bài này"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Quiz View */}
          {isQuiz && (
            <View style={studyStyles.contentCard}>
              <View style={studyStyles.quizHeaderBox}>
                <Award size={20} color="#7c3aed" />
                <View style={{ flex: 1 }}>
                  <Text style={studyStyles.quizHeaderTitle}>Đánh giá sát hạch cuối khóa</Text>
                  <Text style={studyStyles.quizHeaderSubtitle}>
                    Trả lời đúng tất cả các câu hỏi để được cấp chứng nhận hoàn thành.
                  </Text>
                </View>
              </View>

              {quizzes.map((quiz, qIdx) => (
                <View
                  key={`${qIdx}-${quiz.question}`}
                  style={[studyStyles.quizBox, quizErrors[qIdx] && studyStyles.quizBoxError]}
                >
                  <Text style={studyStyles.quizQuestionText}>
                    Câu {qIdx + 1}: {quiz.question}
                  </Text>

                  {quiz.options.map((opt, oIdx) => {
                    const isSelected = answers[qIdx] === oIdx;
                    return (
                      <TouchableOpacity
                        key={`${oIdx}-${opt}`}
                        style={[studyStyles.quizOption, isSelected && studyStyles.quizOptionSelected]}
                        onPress={() => onSelectAnswer(qIdx, oIdx)}
                        activeOpacity={0.7}
                      >
                        {isSelected ? (
                          <CircleDot size={18} color="#7c3aed" />
                        ) : (
                          <Circle size={18} color="#94a3b8" />
                        )}
                        <Text
                          style={[
                            studyStyles.quizOptionText,
                            isSelected && studyStyles.quizOptionTextSelected,
                          ]}
                        >
                          {opt}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}

                  {quizSubmitted && quizErrors[qIdx] && (
                    <View style={studyStyles.quizErrorBanner}>
                      <AlertCircle size={14} color="#dc2626" />
                      <Text style={studyStyles.quizErrorBannerText}>
                        Câu trả lời chưa chính xác, vui lòng chọn lại.
                      </Text>
                    </View>
                  )}
                </View>
              ))}

              <TouchableOpacity style={studyStyles.submitQuizBtn} onPress={onSubmitQuiz} activeOpacity={0.8}>
                <CheckCheck size={18} color="#ffffff" />
                <Text style={studyStyles.submitQuizBtnText}>Nộp bài kiểm tra</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Fallback for Empty Course */}
          {!lesson && !isQuiz && (
            <View style={studyStyles.contentCard}>
              <CheckCircle2 size={48} color="#059669" />
              <Text style={studyStyles.lessonTitle}>
                {enrollment?.status === "completed" ? "Bạn đã hoàn thành khóa học!" : "Bắt đầu khóa học"}
              </Text>
              <Text style={studyStyles.lessonBodyText}>
                {course.description || "Khóa học chưa thiết lập bài giảng trực tiếp."}
              </Text>
              {enrollment?.status !== "completed" && (
                <TouchableOpacity
                  style={studyStyles.completeLessonBtn}
                  onPress={onCompleteDirectly}
                  activeOpacity={0.8}
                >
                  <Text style={studyStyles.completeLessonBtnText}>Xác nhận hoàn thành</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Close button */}
          <TouchableOpacity style={studyStyles.bottomDismissBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={studyStyles.bottomDismissText}>Đóng giao diện học tập</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
      {notification}
    </Modal>
  );
}

// -------------------------------------------------------------
// Course Form Subcomponent
// -------------------------------------------------------------
function CourseForm({
  course,
  companyCode,
  userName,
  onClose,
  onSaved,
}: {
  course?: TrainingCourse;
  companyCode: string;
  userName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(course?.title || "");
  const [description, setDescription] = useState(course?.description || "");
  const [category, setCategory] = useState(course?.category || CATEGORIES[1]);
  const [duration, setDuration] = useState(course?.duration || "");
  const [required, setRequired] = useState(!!course?.isRequired);
  const [autoAssign, setAutoAssign] = useState(!!course?.autoAssignOnboarding);
  const [lessons, setLessons] = useState<Lesson[]>(course?.lessons || []);
  const [quizzes, setQuizzes] = useState<QuizQuestion[]>(course?.quizzes || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!title.trim()) {
      setError("Vui lòng nhập tên khóa học.");
      return;
    }
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const cleanLessons = lessons
        .filter((item) => item.title.trim())
        .map((item) => ({ ...item, title: item.title.trim(), url: item.url.trim() }));
      const cleanQuizzes = quizzes
        .filter((item) => item.question.trim())
        .map((item) => ({
          ...item,
          question: item.question.trim(),
          options: item.options.map((option) => option.trim()).filter(Boolean),
          correctOptionIndex: Math.min(item.correctOptionIndex, Math.max(item.options.length - 1, 0)),
        }));

      const payload = {
        title: title.trim(),
        description: description.trim() || "Chưa có mô tả.",
        category,
        duration: duration.trim() || "Chưa xác định",
        instructor: userName,
        companyCode,
        tags: required ? ["Bắt buộc"] : [category],
        isRequired: required,
        icon: course?.icon && !/[\p{Extended_Pictographic}]/u.test(course.icon) ? course.icon : "graduation-cap",
        autoAssignOnboarding: autoAssign,
        lessons: cleanLessons,
        quizzes: cleanQuizzes,
      };

      const savedCourse = course
        ? await training.updateCourse(course.id, payload)
        : await training.createCourse(payload);

      if (!course && autoAssign) {
        try {
          const employees = (await roster.list(companyCode)).filter((emp) => emp.role !== "superadmin");
          const now = new Date().toISOString();
          const results = await Promise.allSettled(
            employees.map((emp) =>
              training.enroll({
                courseId: savedCourse.id,
                courseTitle: savedCourse.title,
                uid: emp.uid,
                userName: emp.displayName || emp.email || "Nhân viên",
                companyCode,
                progress: 0,
                status: "in_progress",
                startedAt: now,
                completedLessons: [],
                quizPassed: false,
              }),
            ),
          );
          const enrolledCount = results.filter((res) => res.status === "fulfilled").length;
          if (enrolledCount) await training.updateCourse(savedCourse.id, { enrolledCount });
        } catch (assignError) {
          console.warn("Không thể tự động gán khóa học:", assignError);
        }
      }
      onSaved();
    } catch (saveError) {
      setError(messageOf(saveError));
    } finally {
      setBusy(false);
    }
  };

  const addLesson = () =>
    setLessons((current) => [...current, { title: "", url: "", type: "text", content: "" }]);

  const addQuiz = () =>
    setQuizzes((current) => [...current, { question: "", options: ["", ""], correctOptionIndex: 0 }]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={formStyles.topHeader}>
        <View>
          <Text style={formStyles.topHeaderTitle}>
            {course ? "Chỉnh sửa khóa học" : "Tạo khóa học mới"}
          </Text>
          <Text style={formStyles.topHeaderSubtitle}>
            Thiết lập chương trình đào tạo và kiểm tra nội bộ
          </Text>
        </View>
        <TouchableOpacity style={formStyles.closeHeaderBtn} onPress={onClose} activeOpacity={0.7}>
          <X size={20} color="#64748b" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={formStyles.content} keyboardShouldPersistTaps="handled">
        <View style={formStyles.fieldGroup}>
          <Text style={formStyles.fieldLabel}>Tên khóa học *</Text>
          <TextInput
            style={formStyles.input}
            placeholder="Ví dụ: Quy chuẩn an toàn y tế và tiệt trùng"
            placeholderTextColor="#94a3b8"
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View style={formStyles.fieldGroup}>
          <Text style={formStyles.fieldLabel}>Mô tả tóm tắt</Text>
          <TextInput
            style={[formStyles.input, formStyles.multiline]}
            placeholder="Mô tả mục tiêu, đối tượng và nội dung đào tạo..."
            placeholderTextColor="#94a3b8"
            value={description}
            onChangeText={setDescription}
            multiline
          />
        </View>

        <View style={formStyles.fieldGroup}>
          <Text style={formStyles.fieldLabel}>Thời lượng</Text>
          <TextInput
            style={formStyles.input}
            placeholder="Ví dụ: 2 giờ · 4 buổi"
            placeholderTextColor="#94a3b8"
            value={duration}
            onChangeText={setDuration}
          />
        </View>

        <View style={formStyles.fieldGroup}>
          <Text style={formStyles.fieldLabel}>Danh mục</Text>
          <View style={formStyles.choices}>
            {CATEGORIES.slice(1).map((item) => (
              <TouchableOpacity
                key={item}
                style={[formStyles.choice, category === item && formStyles.choiceSelected]}
                onPress={() => setCategory(item)}
                activeOpacity={0.7}
              >
                <Text
                  style={
                    category === item
                      ? formStyles.choiceTextSelected
                      : formStyles.choiceText
                  }
                >
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={formStyles.switchCard}>
          <View style={{ flex: 1 }}>
            <Text style={formStyles.switchCardTitle}>Khóa học bắt buộc</Text>
            <Text style={formStyles.switchCardDesc}>Nhân sự cần hoàn thành theo chính sách viện.</Text>
          </View>
          <Switch
            value={required}
            onValueChange={(val) => {
              setRequired(val);
              if (!val) setAutoAssign(false);
            }}
            trackColor={{ true: "#c4b5fd" }}
            thumbColor={required ? "#7c3aed" : "#f1f5f9"}
          />
        </View>

        <View style={formStyles.switchCard}>
          <View style={{ flex: 1 }}>
            <Text style={formStyles.switchCardTitle}>Tự động gán cho toàn bộ nhân sự</Text>
            <Text style={formStyles.switchCardDesc}>Tự động ghi danh toàn viện khi khóa học được tạo.</Text>
          </View>
          <Switch
            value={autoAssign}
            disabled={!required || !!course}
            onValueChange={setAutoAssign}
            trackColor={{ true: "#c4b5fd" }}
            thumbColor={autoAssign ? "#7c3aed" : "#f1f5f9"}
          />
        </View>

        {/* Lessons section */}
        <View style={formStyles.sectionHeaderRow}>
          <Text style={formStyles.sectionHeaderTitle}>Danh sách bài giảng ({lessons.length})</Text>
          <TouchableOpacity onPress={addLesson} activeOpacity={0.7}>
            <Text style={formStyles.addBtnText}>+ Thêm bài giảng</Text>
          </TouchableOpacity>
        </View>

        {lessons.map((lesson, idx) => (
          <View key={idx} style={formStyles.itemBox}>
            <View style={formStyles.itemBoxHeader}>
              <Text style={formStyles.itemBoxNumber}>Bài {idx + 1}</Text>
              <TouchableOpacity
                onPress={() => setLessons((curr) => curr.filter((_, i) => i !== idx))}
                activeOpacity={0.7}
              >
                <Trash2 size={16} color="#dc2626" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={formStyles.input}
              placeholder="Tên bài giảng"
              placeholderTextColor="#94a3b8"
              value={lesson.title}
              onChangeText={(val) =>
                setLessons((curr) =>
                  curr.map((l, i) => (i === idx ? { ...l, title: val } : l)),
                )
              }
            />
            <TextInput
              style={[formStyles.input, formStyles.multiline]}
              placeholder="Nội dung bài giảng..."
              placeholderTextColor="#94a3b8"
              value={lesson.content || ""}
              onChangeText={(val) =>
                setLessons((curr) =>
                  curr.map((l, i) => (i === idx ? { ...l, content: val } : l)),
                )
              }
              multiline
            />
            <TextInput
              style={formStyles.input}
              placeholder="Link video / tài liệu (tùy chọn)"
              placeholderTextColor="#94a3b8"
              value={lesson.url}
              onChangeText={(val) =>
                setLessons((curr) =>
                  curr.map((l, i) => (i === idx ? { ...l, url: val } : l)),
                )
              }
            />
          </View>
        ))}

        {/* Quiz section */}
        <View style={formStyles.sectionHeaderRow}>
          <Text style={formStyles.sectionHeaderTitle}>Câu hỏi trắc nghiệm ({quizzes.length})</Text>
          <TouchableOpacity onPress={addQuiz} activeOpacity={0.7}>
            <Text style={formStyles.addBtnText}>+ Thêm câu hỏi</Text>
          </TouchableOpacity>
        </View>

        {quizzes.map((quiz, qIdx) => (
          <View key={qIdx} style={formStyles.itemBox}>
            <View style={formStyles.itemBoxHeader}>
              <Text style={formStyles.itemBoxNumber}>Câu hỏi {qIdx + 1}</Text>
              <TouchableOpacity
                onPress={() => setQuizzes((curr) => curr.filter((_, i) => i !== qIdx))}
                activeOpacity={0.7}
              >
                <Trash2 size={16} color="#dc2626" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={formStyles.input}
              placeholder="Nội dung câu hỏi..."
              placeholderTextColor="#94a3b8"
              value={quiz.question}
              onChangeText={(val) =>
                setQuizzes((curr) =>
                  curr.map((q, i) => (i === qIdx ? { ...q, question: val } : q)),
                )
              }
            />
            {quiz.options.map((opt, oIdx) => (
              <View key={oIdx} style={formStyles.optionRow}>
                <TouchableOpacity
                  onPress={() =>
                    setQuizzes((curr) =>
                      curr.map((q, i) => (i === qIdx ? { ...q, correctOptionIndex: oIdx } : q)),
                    )
                  }
                  activeOpacity={0.7}
                >
                  {quiz.correctOptionIndex === oIdx ? (
                    <CircleDot size={18} color="#059669" />
                  ) : (
                    <Circle size={18} color="#94a3b8" />
                  )}
                </TouchableOpacity>
                <TextInput
                  style={[formStyles.input, { flex: 1 }]}
                  placeholder={`Đáp án ${oIdx + 1}`}
                  placeholderTextColor="#94a3b8"
                  value={opt}
                  onChangeText={(val) =>
                    setQuizzes((curr) =>
                      curr.map((q, i) =>
                        i === qIdx
                          ? {
                              ...q,
                              options: q.options.map((cand, cIdx) => (cIdx === oIdx ? val : cand)),
                            }
                          : q,
                      ),
                    )
                  }
                />
              </View>
            ))}
          </View>
        ))}

        <ErrorText message={error} />

        <View style={formStyles.footerBtnRow}>
          <TouchableOpacity
            style={[formStyles.saveBtn, busy && { opacity: 0.6 }]}
            onPress={() => void save()}
            disabled={busy}
            activeOpacity={0.8}
          >
            <Text style={formStyles.saveBtnText}>
              {busy ? "Đang lưu..." : course ? "Cập nhật khóa học" : "Tạo khóa học"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={formStyles.cancelBtn}
            onPress={onClose}
            disabled={busy}
            activeOpacity={0.7}
          >
            <Text style={formStyles.cancelBtnText}>Hủy</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

async function openLink(url: string, showAlert: ReturnType<typeof useAppAlert>["showAlert"]) {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
    await Linking.openURL(parsed.toString());
  } catch {
    showAlert("Không thể mở liên kết", "Đường dẫn tài liệu không hợp lệ hoặc không được thiết bị hỗ trợ.", undefined, "error");
  }
}

// -------------------------------------------------------------
// StyleSheet
// -------------------------------------------------------------
const uiStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 12,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  branchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  branchDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#7c3aed",
  },
  branchName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#7c3aed",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 2,
  },
  createBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },

  // Summary row
  summaryRow: {
    flexDirection: "row",
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderLeftWidth: 4,
  },
  summaryCardActive: {
    backgroundColor: "#f5f3ff",
    borderColor: "#c4b5fd",
  },
  summaryValue: {
    fontSize: 17,
    fontWeight: "800",
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 1,
  },

  // Search
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
    paddingVertical: 6,
  },

  // Category filter chips
  filterChipsRow: {
    flexDirection: "row",
    gap: 7,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  filterChipActive: {
    backgroundColor: "#f5f3ff",
    borderColor: "#7c3aed",
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  filterChipTextActive: {
    color: "#7c3aed",
    fontWeight: "700",
  },

  // Course Card
  courseCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
    gap: 10,
  },
  cardTopRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  courseIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#f5f3ff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#ede9fe",
  },
  courseIconText: {
    fontSize: 24,
  },
  courseHeaderInfo: {
    flex: 1,
    gap: 4,
  },
  badgeGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  categoryBadge: {
    backgroundColor: "#f5f3ff",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#7c3aed",
  },
  requiredBadge: {
    backgroundColor: "#fff1f2",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  requiredBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#e11d48",
  },
  courseTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    lineHeight: 20,
  },
  courseDesc: {
    fontSize: 12,
    color: "#475569",
    lineHeight: 18,
  },

  // Metadata Grid
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    backgroundColor: "#f8fafc",
    padding: 10,
    borderRadius: 12,
  },
  metaItem: {
    width: "47%",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaItemText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },

  // Progress Section
  progressSection: {
    gap: 5,
    paddingTop: 4,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94a3b8",
    letterSpacing: 0.5,
  },
  progressPercentRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  progressPercentText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7c3aed",
  },
  completedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  completedBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },

  // Card Action Row
  cardActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  primaryStudyBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#7c3aed",
    paddingVertical: 9,
    borderRadius: 10,
  },
  completedStudyBtn: {
    backgroundColor: "#059669",
  },
  primaryStudyBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  iconActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },

  // Empty State
  emptyStateContainer: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 32,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  emptyStateDesc: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 18,
  },
  resetFilterBtn: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
  resetFilterText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#7c3aed",
  },

  modalSafeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
});

const studyStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#1e1b4b",
  },
  headerBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  categoryText: {
    color: "#c4b5fd",
    fontSize: 11,
    fontWeight: "700",
  },
  stepIndicatorText: {
    color: "#a5b4fc",
    fontSize: 11,
    fontWeight: "600",
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#312e81",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  progressCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 8,
  },
  progressCardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressCardLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  progressCardValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#7c3aed",
  },
  contentCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
  },
  lessonTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: "#f5f3ff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  lessonTypeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7c3aed",
  },
  lessonTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
  },
  lessonBody: {
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  lessonBodyText: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 21,
  },
  externalLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#eef2ff",
    paddingVertical: 10,
    borderRadius: 10,
  },
  externalLinkText: {
    color: "#4f46e5",
    fontSize: 13,
    fontWeight: "700",
  },
  completeLessonBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#7c3aed",
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 4,
  },
  completeLessonBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  quizHeaderBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#f5f3ff",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ede9fe",
  },
  quizHeaderTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6d28d9",
  },
  quizHeaderSubtitle: {
    fontSize: 11,
    color: "#7c3aed",
    marginTop: 2,
  },
  quizBox: {
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  quizBoxError: {
    backgroundColor: "#fff1f2",
    padding: 10,
    borderRadius: 10,
    borderBottomColor: "#fca5a5",
  },
  quizQuestionText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  quizOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  quizOptionSelected: {
    backgroundColor: "#f5f3ff",
    borderColor: "#8b5cf6",
  },
  quizOptionText: {
    fontSize: 13,
    color: "#334155",
    flex: 1,
  },
  quizOptionTextSelected: {
    color: "#6d28d9",
    fontWeight: "700",
  },
  quizErrorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  quizErrorBannerText: {
    color: "#dc2626",
    fontSize: 11,
    fontWeight: "600",
  },
  submitQuizBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#059669",
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 10,
  },
  submitQuizBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  bottomDismissBtn: {
    alignItems: "center",
    paddingVertical: 10,
  },
  bottomDismissText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "600",
  },
});

const formStyles = StyleSheet.create({
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  topHeaderTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
  },
  topHeaderSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  closeHeaderBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: "#0f172a",
    fontSize: 13,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  choices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  choice: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#ffffff",
  },
  choiceSelected: {
    borderColor: "#7c3aed",
    backgroundColor: "#f5f3ff",
  },
  choiceText: {
    color: "#64748b",
    fontSize: 12,
  },
  choiceTextSelected: {
    color: "#7c3aed",
    fontSize: 12,
    fontWeight: "700",
  },
  switchCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  switchCardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  switchCardDesc: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  addBtnText: {
    color: "#7c3aed",
    fontSize: 12,
    fontWeight: "700",
  },
  itemBox: {
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#f8fafc",
  },
  itemBoxHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemBoxNumber: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  footerBtnRow: {
    gap: 8,
    marginTop: 10,
  },
  saveBtn: {
    backgroundColor: "#7c3aed",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  saveBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  cancelBtn: {
    backgroundColor: "#f1f5f9",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelBtnText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "600",
  },
});
