import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  notifications,
  questionOptions,
  questions,
  quizAttempts,
  quizzes,
  studentAnswers,
  studentProfiles,
  studyMaterials,
  subjects,
  teacherProfiles,
  users,
} from '../db/schema.ts';
import { hashPassword } from './auth.ts';
import { ensureUploadDirs, MATERIALS_DIR } from './storage.ts';

function buildMinimalPdfBuffer(title: string, lines: string[]): Buffer {
  const escapePdf = (text: string) =>
    text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const textCommands = [
    'BT',
    '/F1 18 Tf',
    '50 750 Td',
    `(${escapePdf(title)}) Tj`,
    '/F1 11 Tf',
    '0 -28 Td',
    ...lines.flatMap((line) => [`(${escapePdf(line)}) Tj`, '0 -18 Td']),
    'ET',
  ].join('\n');

  const objects: string[] = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  objects.push(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
  );
  objects.push(
    `4 0 obj\n<< /Length ${Buffer.byteLength(textCommands, 'utf8')} >>\nstream\n${textCommands}\nendstream\nendobj\n`,
  );
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }
  const xrefPos = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}

declare global {
  var _scholarPulseSeedPromise: Promise<void> | undefined;
  var _scholarPulseSeedDone: boolean | undefined;
}

async function runSeedInternal(): Promise<void> {
  ensureUploadDirs();

  const existingSubjects = await db.select({ id: subjects.id }).from(subjects).limit(1);
  if (existingSubjects.length > 0) {
    global._scholarPulseSeedDone = true;
    return;
  }

  const teacherPasswordHash = process.env.DEMO_TEACHER_PASSWORD
    ? await hashPassword(process.env.DEMO_TEACHER_PASSWORD)
    : null;
  const studentPasswordHash = process.env.DEMO_STUDENT_PASSWORD
    ? await hashPassword(process.env.DEMO_STUDENT_PASSWORD)
    : null;

  const [teacher] = await db
    .insert(users)
    .values({
      uid: 'demo-teacher-elena',
      email: 'teacher@quizsystem.com',
      passwordHash: teacherPasswordHash,
      fullName: 'Dr. Elena Vance',
      role: 'teacher',
      emailNotifications: true,
      quizReminders: true,
      resultAlerts: true,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { fullName: 'Dr. Elena Vance' },
    })
    .returning();

  await db
    .insert(teacherProfiles)
    .values({
      userId: teacher.id,
      subjectSpecialty: 'Algorithms & Distributed Systems',
      qualification: 'Ph.D. Computer Science, ETH Zurich',
      department: 'School of Computing',
      bio: 'Associate Professor focusing on algorithmic graph theory, database internals, and systems reliability.',
    })
    .onConflictDoNothing({ target: teacherProfiles.userId });

  const [student] = await db
    .insert(users)
    .values({
      uid: 'demo-student-aarav',
      email: 'student@quizsystem.com',
      passwordHash: studentPasswordHash,
      fullName: 'Aarav Mehta',
      role: 'student',
      emailNotifications: true,
      quizReminders: true,
      resultAlerts: true,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { fullName: 'Aarav Mehta' },
    })
    .returning();

  await db
    .insert(studentProfiles)
    .values({
      userId: student.id,
      course: 'B.Tech Computer Science',
      semester: 'Semester 5',
      enrollmentNumber: 'CS-2024-089',
      department: 'School of Computing',
    })
    .onConflictDoNothing({ target: studentProfiles.userId });

  const [student2] = await db
    .insert(users)
    .values({
      uid: 'demo-student-maya',
      email: 'maya.lin@quizsystem.com',
      passwordHash: null,
      fullName: 'Maya Lin',
      role: 'student',
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { fullName: 'Maya Lin' },
    })
    .returning();

  await db
    .insert(studentProfiles)
    .values({
      userId: student2.id,
      course: 'B.Tech Computer Science',
      semester: 'Semester 5',
      enrollmentNumber: 'CS-2024-104',
      department: 'School of Computing',
    })
    .onConflictDoNothing({ target: studentProfiles.userId });

  const [student3] = await db
    .insert(users)
    .values({
      uid: 'demo-student-liam',
      email: 'liam.patel@quizsystem.com',
      passwordHash: null,
      fullName: 'Liam Patel',
      role: 'student',
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { fullName: 'Liam Patel' },
    })
    .returning();

  await db
    .insert(studentProfiles)
    .values({
      userId: student3.id,
      course: 'B.Sc Data Engineering',
      semester: 'Semester 4',
      enrollmentNumber: 'DE-2024-041',
      department: 'School of Computing',
    })
    .onConflictDoNothing({ target: studentProfiles.userId });

  const subjectRows = await db
    .insert(subjects)
    .values([
      {
        name: 'Algorithms & Data Structures',
        code: 'CS301',
        description: 'Asymptotic analysis, graph algorithms, trees, and dynamic programming.',
        createdBy: teacher.id,
      },
      {
        name: 'Database Systems',
        code: 'CS304',
        description: 'Relational algebra, normalization, indexing, and ACID transactions.',
        createdBy: teacher.id,
      },
      {
        name: 'Operating Systems',
        code: 'CS308',
        description: 'Process scheduling, synchronization, deadlocks, and virtual memory.',
        createdBy: teacher.id,
      },
      {
        name: 'Web Architecture',
        code: 'CS312',
        description: 'HTTP protocols, REST APIs, caching, and distributed web scalability.',
        createdBy: teacher.id,
      },
      {
        name: 'Discrete Mathematics',
        code: 'MA201',
        description: 'Combinatorics, propositional logic, relations, and recurrence models.',
        createdBy: teacher.id,
      },
    ])
    .returning();

  const [algSubject, dbSubject, osSubject, webSubject] = subjectRows;

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [quiz1, quiz2, quiz3, quiz4] = await db
    .insert(quizzes)
    .values([
      {
        title: 'Asymptotic Complexity & Graph Traversal',
        subjectId: algSubject.id,
        teacherId: teacher.id,
        description:
          'Evaluate time/space complexity bounds, BFS/DFS traversal properties, and shortest-path invariants.',
        difficulty: 'medium',
        durationMinutes: 20,
        totalMarks: 10,
        passingPercentage: 60,
        startDate: oneWeekAgo,
        endDate: oneMonthLater,
        instructions:
          'Read each scenario carefully. You may flag questions for review and navigate freely before submitting.',
        questionCount: 5,
        status: 'published',
        isActive: true,
      },
      {
        title: 'Relational Algebra & BCNF Normalization',
        subjectId: dbSubject.id,
        teacherId: teacher.id,
        description:
          'Covers functional dependencies, lossless-join decomposition, B-tree indexing, and SQL isolation levels.',
        difficulty: 'easy',
        durationMinutes: 15,
        totalMarks: 8,
        passingPercentage: 50,
        startDate: oneWeekAgo,
        endDate: oneMonthLater,
        instructions:
          'All questions carry equal marks. Select the best option or True/False statement.',
        questionCount: 4,
        status: 'published',
        isActive: true,
      },
      {
        title: 'Concurrency, Deadlocks & Virtual Memory',
        subjectId: osSubject.id,
        teacherId: teacher.id,
        description:
          'Deep dive into Coffman deadlock conditions, semaphore synchronization, and multi-level page tables.',
        difficulty: 'hard',
        durationMinutes: 25,
        totalMarks: 12,
        passingPercentage: 65,
        startDate: oneWeekAgo,
        endDate: oneMonthLater,
        instructions:
          'Timer starts immediately upon clicking Start Quiz. Unanswered questions receive zero credit.',
        questionCount: 4,
        status: 'published',
        isActive: true,
      },
      {
        title: 'HTTP/3, Caching & API Idempotency',
        subjectId: webSubject.id,
        teacherId: teacher.id,
        description: 'Draft assessment covering QUIC transport, ETag revalidation, and REST semantics.',
        difficulty: 'medium',
        durationMinutes: 20,
        totalMarks: 4,
        passingPercentage: 60,
        instructions: 'Draft quiz awaiting final question review before publishing.',
        questionCount: 2,
        status: 'draft',
        isActive: false,
      },
    ])
    .returning();

  interface SeedQuestionDef {
    quizId: number | null;
    subjectId: number;
    topic: string;
    questionType: 'mcq' | 'true_false';
    questionText: string;
    difficulty: 'easy' | 'medium' | 'hard';
    marks: number;
    explanation: string;
    inBank: boolean;
    options: { text: string; isCorrect: boolean }[];
  }

  const questionDefs: SeedQuestionDef[] = [
    // Quiz 1: Algorithms (5 questions, 10 marks)
    {
      quizId: quiz1.id,
      subjectId: algSubject.id,
      topic: 'Graph Traversal',
      questionType: 'mcq',
      questionText:
        'What is the worst-case time complexity of Breadth-First Search (BFS) on a connected graph represented with an adjacency list (V vertices, E edges)?',
      difficulty: 'easy',
      marks: 2,
      explanation: 'BFS visits every vertex once and scans each adjacency list edge once, yielding O(V + E).',
      inBank: true,
      options: [
        { text: 'O(V + E)', isCorrect: true },
        { text: 'O(V^2)', isCorrect: false },
        { text: 'O(V log E)', isCorrect: false },
        { text: 'O(E log V)', isCorrect: false },
      ],
    },
    {
      quizId: quiz1.id,
      subjectId: algSubject.id,
      topic: 'Shortest Paths',
      questionType: 'mcq',
      questionText:
        'Which shortest-path algorithm fails to guarantee optimal paths when negative edge weights exist without negative cycles?',
      difficulty: 'medium',
      marks: 2,
      explanation: "Dijkstra's greedy relaxation assumes non-negative edge weights once a vertex is finalized.",
      inBank: true,
      options: [
        { text: "Dijkstra's Algorithm", isCorrect: true },
        { text: 'Bellman-Ford Algorithm', isCorrect: false },
        { text: 'Floyd-Warshall Algorithm', isCorrect: false },
        { text: 'SPFA Algorithm', isCorrect: false },
      ],
    },
    {
      quizId: quiz1.id,
      subjectId: algSubject.id,
      topic: 'Sorting & Bounds',
      questionType: 'true_false',
      questionText:
        'Comparison-based sorting algorithms have a tight worst-case lower bound of Omega(n log n) comparisons.',
      difficulty: 'easy',
      marks: 2,
      explanation: 'Any decision tree for n! permutations requires height at least log2(n!) = Omega(n log n).',
      inBank: true,
      options: [
        { text: 'True', isCorrect: true },
        { text: 'False', isCorrect: false },
      ],
    },
    {
      quizId: quiz1.id,
      subjectId: algSubject.id,
      topic: 'Dynamic Programming',
      questionType: 'mcq',
      questionText:
        'Using a binary min-heap priority queue, what is the time complexity of Prim’s Minimum Spanning Tree algorithm?',
      difficulty: 'medium',
      marks: 2,
      explanation: 'Each vertex extract-min and edge decrease-key takes O(log V), totaling O((V + E) log V).',
      inBank: true,
      options: [
        { text: 'O((V + E) log V)', isCorrect: true },
        { text: 'O(V^2 log V)', isCorrect: false },
        { text: 'O(V + E)', isCorrect: false },
        { text: 'O(E^2)', isCorrect: false },
      ],
    },
    {
      quizId: quiz1.id,
      subjectId: algSubject.id,
      topic: 'DAGs',
      questionType: 'mcq',
      questionText:
        'A topological ordering exists for a directed graph if and only if the graph satisfies which property?',
      difficulty: 'medium',
      marks: 2,
      explanation: 'Only Directed Acyclic Graphs (DAGs) admit a linear topological ordering.',
      inBank: true,
      options: [
        { text: 'It contains no directed cycles', isCorrect: true },
        { text: 'It is strongly connected', isCorrect: false },
        { text: 'Every vertex has even in-degree', isCorrect: false },
        { text: 'It is bipartite', isCorrect: false },
      ],
    },

    // Quiz 2: Database Systems (4 questions, 8 marks)
    {
      quizId: quiz2.id,
      subjectId: dbSubject.id,
      topic: 'Normalization',
      questionType: 'mcq',
      questionText: 'A relation R is in Boyce-Codd Normal Form (BCNF) if for every non-trivial functional dependency X -> Y:',
      difficulty: 'medium',
      marks: 2,
      explanation: 'BCNF requires the determinant X of every non-trivial FD to be a superkey of R.',
      inBank: true,
      options: [
        { text: 'X is a superkey of R', isCorrect: true },
        { text: 'Y is a prime attribute', isCorrect: false },
        { text: 'X is a proper subset of a candidate key', isCorrect: false },
        { text: 'Y has no transitive dependencies', isCorrect: false },
      ],
    },
    {
      quizId: quiz2.id,
      subjectId: dbSubject.id,
      topic: 'Transactions',
      questionType: 'mcq',
      questionText:
        'Which SQL transaction isolation level prevents dirty reads and non-repeatable reads, while still permitting phantom reads in standard SQL?',
      difficulty: 'easy',
      marks: 2,
      explanation: 'Repeatable Read locks existing rows read but may allow newly inserted phantom rows in standard SQL.',
      inBank: true,
      options: [
        { text: 'REPEATABLE READ', isCorrect: true },
        { text: 'READ UNCOMMITTED', isCorrect: false },
        { text: 'READ COMMITTED', isCorrect: false },
        { text: 'SERIALIZABLE', isCorrect: false },
      ],
    },
    {
      quizId: quiz2.id,
      subjectId: dbSubject.id,
      topic: 'Indexing',
      questionType: 'true_false',
      questionText:
        'In a B+ Tree index, all actual data pointers or record tuples are stored exclusively in the leaf nodes.',
      difficulty: 'easy',
      marks: 2,
      explanation: 'Internal nodes in a B+ Tree store only routing keys, while leaf nodes store record pointers linked sequentially.',
      inBank: true,
      options: [
        { text: 'True', isCorrect: true },
        { text: 'False', isCorrect: false },
      ],
    },
    {
      quizId: quiz2.id,
      subjectId: dbSubject.id,
      topic: 'Relational Algebra',
      questionType: 'mcq',
      questionText:
        'Which relational algebra operator is used to filter rows that satisfy a given boolean predicate?',
      difficulty: 'easy',
      marks: 2,
      explanation: 'Selection (sigma) filters tuples matching a predicate; Projection (pi) selects columns.',
      inBank: true,
      options: [
        { text: 'Selection (sigma)', isCorrect: true },
        { text: 'Projection (pi)', isCorrect: false },
        { text: 'Cartesian Product (x)', isCorrect: false },
        { text: 'Rename (rho)', isCorrect: false },
      ],
    },

    // Quiz 3: Operating Systems (4 questions, 12 marks)
    {
      quizId: quiz3.id,
      subjectId: osSubject.id,
      topic: 'Deadlocks',
      questionType: 'mcq',
      questionText:
        'Which of the following is NOT one of the four necessary Coffman conditions for a deadlock to occur?',
      difficulty: 'medium',
      marks: 3,
      explanation: 'The four conditions are Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait.',
      inBank: true,
      options: [
        { text: 'Starvation Freedom', isCorrect: true },
        { text: 'Mutual Exclusion', isCorrect: false },
        { text: 'Hold and Wait', isCorrect: false },
        { text: 'Circular Wait', isCorrect: false },
      ],
    },
    {
      quizId: quiz3.id,
      subjectId: osSubject.id,
      topic: 'Virtual Memory',
      questionType: 'mcq',
      questionText:
        'Why does Belady’s Anomaly occur with FIFO page replacement but never with Least Recently Used (LRU)?',
      difficulty: 'hard',
      marks: 3,
      explanation: 'LRU is a stack algorithm satisfying the inclusion property; FIFO does not satisfy the stack property.',
      inBank: true,
      options: [
        { text: 'LRU satisfies the stack inclusion property while FIFO does not', isCorrect: true },
        { text: 'FIFO uses a larger TLB cache than LRU', isCorrect: false },
        { text: 'LRU avoids dirty page writebacks completely', isCorrect: false },
        { text: 'FIFO always evicts kernel-space pages first', isCorrect: false },
      ],
    },
    {
      quizId: quiz3.id,
      subjectId: osSubject.id,
      topic: 'Scheduling',
      questionType: 'true_false',
      questionText:
        'Shortest Remaining Time First (SRTF) is the preemptive counterpart to Shortest Job First (SJF) scheduling.',
      difficulty: 'easy',
      marks: 3,
      explanation: 'SRTF preempts the running process whenever a newly arrived process has a shorter remaining CPU burst.',
      inBank: true,
      options: [
        { text: 'True', isCorrect: true },
        { text: 'False', isCorrect: false },
      ],
    },
    {
      quizId: quiz3.id,
      subjectId: osSubject.id,
      topic: 'Synchronization',
      questionType: 'mcq',
      questionText:
        'In a counting semaphore initialized to 4, after 6 wait() operations and 3 signal() operations, what is the semaphore value?',
      difficulty: 'medium',
      marks: 3,
      explanation: 'Starting at 4: 4 - 6 + 3 = 1.',
      inBank: true,
      options: [
        { text: '1', isCorrect: true },
        { text: '-1', isCorrect: false },
        { text: '2', isCorrect: false },
        { text: '0', isCorrect: false },
      ],
    },

    // Quiz 4 (Draft): Web Architecture (2 questions, 4 marks)
    {
      quizId: quiz4.id,
      subjectId: webSubject.id,
      topic: 'HTTP Semantics',
      questionType: 'mcq',
      questionText: 'Which HTTP request method is defined as safe and idempotent in RFC 9110?',
      difficulty: 'easy',
      marks: 2,
      explanation: 'GET is both safe (read-only) and idempotent; PUT and DELETE are idempotent but not safe.',
      inBank: true,
      options: [
        { text: 'GET', isCorrect: true },
        { text: 'POST', isCorrect: false },
        { text: 'PATCH', isCorrect: false },
        { text: 'CONNECT', isCorrect: false },
      ],
    },
    {
      quizId: quiz4.id,
      subjectId: webSubject.id,
      topic: 'Caching',
      questionType: 'true_false',
      questionText:
        'The HTTP ETag response header allows conditional validation via If-None-Match to return 304 Not Modified.',
      difficulty: 'easy',
      marks: 2,
      explanation: 'Clients send the cached ETag in If-None-Match; if unchanged, the origin responds with 304.',
      inBank: true,
      options: [
        { text: 'True', isCorrect: true },
        { text: 'False', isCorrect: false },
      ],
    },

    // Standalone Question Bank item
    {
      quizId: null,
      subjectId: algSubject.id,
      topic: 'Divide & Conquer',
      questionType: 'mcq',
      questionText:
        'By the Master Theorem, what is the asymptotic solution to T(n) = 2T(n/2) + n?',
      difficulty: 'medium',
      marks: 2,
      explanation: 'Case 2 of the Master Theorem applies since f(n) = Theta(n^(log_2 2)), giving Theta(n log n).',
      inBank: true,
      options: [
        { text: 'Theta(n log n)', isCorrect: true },
        { text: 'Theta(n)', isCorrect: false },
        { text: 'Theta(n^2)', isCorrect: false },
        { text: 'Theta(log n)', isCorrect: false },
      ],
    },
  ];

  const insertedQuestionsByQuiz = new Map<number, { questionId: number; marks: number; correctOptionId: number; wrongOptionId: number }[]>();

  for (const qDef of questionDefs) {
    const [qRow] = await db
      .insert(questions)
      .values({
        quizId: qDef.quizId,
        teacherId: teacher.id,
        subjectId: qDef.subjectId,
        topic: qDef.topic,
        questionType: qDef.questionType,
        questionText: qDef.questionText,
        difficulty: qDef.difficulty,
        marks: qDef.marks,
        explanation: qDef.explanation,
        inBank: qDef.inBank,
      })
      .returning();

    const optRows = await db
      .insert(questionOptions)
      .values(
        qDef.options.map((opt, idx) => ({
          questionId: qRow.id,
          optionText: opt.text,
          isCorrect: opt.isCorrect,
          optionOrder: idx,
        })),
      )
      .returning();

    const correctOpt = optRows.find((o) => o.isCorrect) ?? optRows[0];
    const wrongOpt = optRows.find((o) => !o.isCorrect) ?? optRows[0];

    if (qDef.quizId !== null) {
      const list = insertedQuestionsByQuiz.get(qDef.quizId) ?? [];
      list.push({
        questionId: qRow.id,
        marks: qDef.marks,
        correctOptionId: correctOpt.id,
        wrongOptionId: wrongOpt.id,
      });
      insertedQuestionsByQuiz.set(qDef.quizId, list);
    }
  }

  // Create realistic study materials (valid PDFs on disk)
  const sampleMaterials = [
    {
      title: 'Graph Algorithms & BFS/DFS Cheat Sheet',
      description: 'Concise reference covering adjacency representations, BFS shortest paths, and topological sorting.',
      subjectId: algSubject.id,
      topic: 'Graph Traversal',
      fileName: 'graph-algorithms-reference.pdf',
      storedFileName: 'seed-graph-algorithms.pdf',
      lines: [
        'CS301: Algorithms & Data Structures',
        '1. Breadth-First Search (BFS): Queue-based level traversal in O(V + E).',
        '2. Depth-First Search (DFS): Discovery/finish timestamps and cycle detection.',
        '3. Dijkstra: Non-negative edge weights in O((V + E) log V) with min-heap.',
        '4. Topological Sort: Valid for Directed Acyclic Graphs (DAGs).',
      ],
    },
    {
      title: 'BCNF & Normal Forms Worked Examples',
      description: 'Step-by-step decomposition examples for 2NF, 3NF, and Boyce-Codd Normal Form.',
      subjectId: dbSubject.id,
      topic: 'Normalization',
      fileName: 'bcnf-normalization-guide.pdf',
      storedFileName: 'seed-bcnf-guide.pdf',
      lines: [
        'CS304: Database Systems',
        '1. Functional Dependency X -> Y: X determines Y across all valid tuples.',
        '2. 3NF: Every non-trivial FD X -> A has X superkey or A prime attribute.',
        '3. BCNF: Every non-trivial FD X -> Y requires X to be a superkey.',
        '4. B+ Tree Indexing: All record pointers reside in sequentially linked leaves.',
      ],
    },
    {
      title: 'Deadlock Prevention & Virtual Memory Notes',
      description: 'Lecture summary on Coffman conditions, Banker algorithm, and multi-level page tables.',
      subjectId: osSubject.id,
      topic: 'Deadlocks & Paging',
      fileName: 'os-concurrency-memory-notes.pdf',
      storedFileName: 'seed-os-notes.pdf',
      lines: [
        'CS308: Operating Systems',
        '1. Coffman Conditions: Mutual Exclusion, Hold & Wait, No Preemption, Circular Wait.',
        '2. Counting Semaphores: wait() decrements, signal() increments atomically.',
        '3. Virtual Memory: TLB hit ratio determines effective memory access time.',
        '4. Page Replacement: LRU satisfies stack inclusion property; FIFO does not.',
      ],
    },
  ];

  for (const mat of sampleMaterials) {
    const pdfBuf = buildMinimalPdfBuffer(mat.title, mat.lines);
    const fullPath = path.resolve(MATERIALS_DIR, mat.storedFileName);
    fs.writeFileSync(fullPath, pdfBuf);
    await db.insert(studyMaterials).values({
      title: mat.title,
      description: mat.description,
      subjectId: mat.subjectId,
      teacherId: teacher.id,
      topic: mat.topic,
      fileName: mat.fileName,
      storedFileName: mat.storedFileName,
      fileType: 'PDF',
      mimeType: 'application/pdf',
      fileSizeBytes: pdfBuf.byteLength,
      isPublished: true,
      downloadCount: 14,
    });
  }

  // Seed historical attempts (leave quiz3 unattempted for demo student so Pending Quizzes > 0!)
  async function createSeedAttempt(
    quizId: number,
    studentId: number,
    passingPct: number,
    correctMask: boolean[],
    daysAgo: number,
    durationSecs: number,
  ) {
    const qItems = insertedQuestionsByQuiz.get(quizId) ?? [];
    let correctAnswers = 0;
    let incorrectAnswers = 0;
    let totalMarks = 0;
    let obtainedMarks = 0;

    const answersPayload = qItems.map((q, i) => {
      const isRight = correctMask[i] ?? true;
      totalMarks += q.marks;
      if (isRight) {
        correctAnswers += 1;
        obtainedMarks += q.marks;
      } else {
        incorrectAnswers += 1;
      }
      return {
        questionId: q.questionId,
        selectedOptionId: isRight ? q.correctOptionId : q.wrongOptionId,
        isCorrect: isRight,
        marksAwarded: isRight ? q.marks : 0,
      };
    });

    const percentage = totalMarks > 0 ? Math.round((obtainedMarks / totalMarks) * 1000) / 10 : 0;
    const passed = percentage >= passingPct;
    const submittedAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const startedAt = new Date(submittedAt.getTime() - durationSecs * 1000);

    const [attempt] = await db
      .insert(quizAttempts)
      .values({
        quizId,
        studentId,
        status: 'submitted',
        totalQuestions: qItems.length,
        correctAnswers,
        incorrectAnswers,
        unansweredQuestions: 0,
        totalMarks,
        obtainedMarks,
        percentage,
        passed,
        timeTakenSeconds: durationSecs,
        startedAt,
        submittedAt,
      })
      .returning();

    if (answersPayload.length > 0) {
      await db.insert(studentAnswers).values(
        answersPayload.map((a) => ({
          attemptId: attempt.id,
          questionId: a.questionId,
          selectedOptionId: a.selectedOptionId,
          isMarkedForReview: false,
          isCorrect: a.isCorrect,
          marksAwarded: a.marksAwarded,
        })),
      );
    }
  }

  // Demo student attempts on quiz1 & quiz2 (quiz3 remains pending!)
  await createSeedAttempt(quiz2.id, student.id, 50, [true, true, true, false], 5, 512);
  await createSeedAttempt(quiz1.id, student.id, 60, [true, true, true, false, true], 2, 740);

  // Other students' attempts for rich Teacher analytics
  await createSeedAttempt(quiz1.id, student2.id, 60, [true, true, true, true, true], 4, 620);
  await createSeedAttempt(quiz2.id, student2.id, 50, [true, true, false, true], 3, 490);
  await createSeedAttempt(quiz3.id, student2.id, 65, [true, true, true, false], 1, 980);
  await createSeedAttempt(quiz1.id, student3.id, 60, [true, false, true, false, false], 3, 810);
  await createSeedAttempt(quiz3.id, student3.id, 65, [true, false, true, true], 1, 1120);

  // Seed Notifications
  await db.insert(notifications).values([
    {
      userId: student.id,
      title: 'New Quiz Available',
      message: 'Concurrency, Deadlocks & Virtual Memory (CS308) is now open for attempts.',
      type: 'quiz',
      isRead: false,
      linkUrl: '/student/quizzes',
    },
    {
      userId: student.id,
      title: 'Quiz Graded',
      message: 'You scored 80% on Asymptotic Complexity & Graph Traversal.',
      type: 'result',
      isRead: false,
      linkUrl: '/student/results',
    },
    {
      userId: teacher.id,
      title: 'New Student Submission',
      message: 'Maya Lin completed Concurrency, Deadlocks & Virtual Memory with 75%.',
      type: 'result',
      isRead: false,
      linkUrl: '/teacher/results',
    },
  ]);

  global._scholarPulseSeedDone = true;
}

export async function ensureSeedData(): Promise<void> {
  if (global._scholarPulseSeedDone) return;
  if (!global._scholarPulseSeedPromise) {
    global._scholarPulseSeedPromise = runSeedInternal().catch((err) => {
      global._scholarPulseSeedPromise = undefined;
      console.error('Seed failed:', err);
      throw err;
    });
  }
  await global._scholarPulseSeedPromise;
}
