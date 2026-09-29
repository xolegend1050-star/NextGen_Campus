/**
 * Seeds the Resources and Interview Questions libraries.
 *
 * The resources table held four perfectly good entries, but every one of them
 * had is_approved = false, and the public listing only returns approved rows, so
 * the page rendered "No resources found" for everybody. The interview questions
 * table was empty outright.
 *
 * Approval is not something a student can do from the interface, and the admin
 * queue is for moderating user submissions rather than for a library that ships
 * with the project, so these are approved on the way in.
 */
require('dotenv').config();
const { Client } = require('pg');

const DB_URL = process.env.DATABASE_URL || 'postgres://localhost/nextgen';

const RESOURCES = [
  ['DBMS Normalization Guide', 'document', 'Database Systems',
   '1NF through BCNF, each with a worked example of a badly designed table and the step that fixes it.',
   ['dbms', 'normalization', 'exam']],
  ['SQL Joins Visual Guide', 'document', 'Database Systems',
   'Every join type on one page, with the kind of question each one actually answers.',
   ['sql', 'joins', 'reference']],
  ['Indexing and Query Performance', 'document', 'Database Systems',
   'Why an index helps, when it does not, how a composite index picks a column order, and reading an EXPLAIN plan.',
   ['sql', 'performance', 'indexes']],
  ['Computer Networks Cheat Sheet', 'document', 'Computer Networks',
   'OSI and TCP layers side by side, with the headers, port numbers and flags that turn up in questions.',
   ['networking', 'reference', 'exam']],
  ['Subnetting Worked Problems', 'document', 'Computer Networks',
   'Ten problems from /24 to /30, each solved from the network address upwards rather than by formula.',
   ['networking', 'subnetting', 'practice']],
  ['TCP Three-Way Handshake', 'link', 'Computer Networks',
   'How a connection is established, torn down, and what each flag is telling you.',
   ['tcp', 'networking'], 'https://www.geeksforgeeks.org/tcp-three-way-handshake/'],
  ['Operating Systems Concepts', 'document', 'Operating Systems',
   'Processes against threads, scheduling, deadlock and its four conditions, paging and virtual memory.',
   ['os', 'exam', 'reference']],
  ['Deadlock: Detection and Recovery', 'document', 'Operating Systems',
   'Banker’s algorithm, wait-for graph, and the practical difference between prevention, avoidance and recovery.',
   ['os', 'deadlock', 'algorithms']],
  ['DSA Cheat Sheet', 'document', 'Data Structures',
   'Complexity of every structure worth knowing, and the pattern each problem shape is usually hiding.',
   ['dsa', 'reference', 'exam']],
  ['Tree Traversals Visualised', 'link', 'Data Structures',
   'Preorder, inorder and postorder on the same tree, with the recursion written out.',
   ['dsa', 'trees'], 'https://visualgo.net/en/bst'],
  ['Sorting Algorithms Compared', 'document', 'Data Structures',
   'Bubble, insertion, selection, merge, quick, heap and counting on time, space, stability and when each wins.',
   ['dsa', 'sorting']],
  ['OOP Principles Explained', 'document', 'Object Oriented Programming',
   'Encapsulation, abstraction, polymorphism and inheritance, each with the code smell that means you got it wrong.',
   ['oop', 'reference']],
  ['Aptitude Shortcuts', 'document', 'Aptitude',
   'Time and work, ratios, percentages and probability, reduced to the handful of patterns that repeat.',
   ['aptitude', 'placement']],
  ['Communication and HR Questions', 'document', 'Interview Preparation',
   'Tell me about yourself, why this role, what are your weaknesses, and how to answer without sounding rehearsed.',
   ['hr', 'interview']],
  ['Git and GitHub Essentials', 'link', 'Software Engineering',
   'Branching, merging, rebasing and recovering a commit you did not mean to make.',
   ['git', 'tools'], 'https://git-scm.com/book/en/v2'],
  ['Python for Interview Prep', 'document', 'Python',
   'The built-ins worth knowing cold: comprehensions, itertools, collections, and the gotchas around mutables.',
   ['python', 'interview']],
  ['Java Collections Cheat Sheet', 'document', 'Java',
   'List, Set and Map implementations with their real costs, and when ArrayList is the wrong answer.',
   ['java', 'collections']],
  ['Introduction to REST APIs', 'document', 'Web Development',
   'Methods and status codes, idempotency, versioning, and the difference between authentication and authorisation.',
   ['web', 'api', 'rest']],
  ['React Rendering Explained', 'link', 'Web Development',
   'What a re-render costs, why keys matter, and when useMemo is not helping you.',
   ['react', 'web'], 'https://react.dev/learn/preserving-and-resetting-state'],
  ['System Design Interview Guide', 'document', 'Interview Preparation',
   'How to start a design question, estimate scale, and where the follow-up questions usually go.',
   ['system-design', 'interview']]
];

const QUESTIONS = [
  // ---- data structures and algorithms
  ['Reverse a linked list', 'Given a singly linked list, return the list reversed in one pass. What is the time complexity?',
   'Keep a previous pointer while walking the list and flip each next pointer as you go. One pass, O(n) time, O(1) space.',
   'Easy', 'Data Structures', ['linked-list'], 3],
  ['Find the duplicate number in an array', 'An array of n+1 integers holds values 1..n. Find the duplicate in O(n) time and O(1) space.',
   'Treat the array as a linked list: for each index move to index value[index]. The entry point you reach twice is the duplicate. This is the Floyd cycle detection problem in disguise.',
   'Medium', 'Data Structures', ['arrays', 'pointers'], 4],
  ['Detect a cycle in a linked list', 'Given a linked list, decide whether it contains a cycle and return the node where it begins.',
   'Floyd tortoise and hare. Advance one pointer one step and the other two. If they meet there is a cycle; restart one from the head and advance both one step at a time and the next meeting is the cycle start.',
   'Medium', 'Data Structures', ['linked-list', 'pointers'], 4],
  ['Two sum returns indices, not values', 'Given an array of integers and a target, return the indices of the two numbers adding up to it.',
   'One pass with a hash map of value to index seen so far. For each element check whether target minus it is already in the map, and if so you have both indices. O(n) time, O(n) space.',
   'Easy', 'Data Structures', ['arrays', 'hashing'], 5],
  ['Longest substring without repeating characters', 'Return the length of the longest substring containing no duplicate characters.',
   'Sliding window with a map holding the last index of each character. When the right pointer hits a repeat, move the left pointer to just past the previous occurrence. O(n).',
   'Medium', 'Data Structures', ['strings', 'sliding-window'], 4],
  ['Merge overlapping intervals', 'Given a list of intervals, merge any that overlap and return the result.',
   'Sort by start first, then walk the result: if the next interval starts at or before the current end, extend the end to the larger of the two, otherwise push a new interval.',
   'Medium', 'Data Structures', ['arrays', 'sorting'], 4],
  ['Find the lowest common ancestor in a BST', 'Given a binary search tree and two nodes, return their lowest common ancestor.',
   'From the root, if both nodes are on the same side go that way, if they are on opposite sides this root is the answer, and if you reach a node that is either node that is the answer. O(h).',
   'Medium', 'Data Structures', ['trees', 'bst'], 3],
  ['What is a balanced binary tree, and how do you rebalance?', 'Explain AVL and red-black trees.',
   'A tree is height balanced when the left and right subtrees of every node differ in height by at most one. AVL enforces this with a rotation on insert or delete, giving O(log n) lookups but more rotations. Red-black trees relax to a looser invariant with a black-height rule, giving fewer rotations and still O(log n).',
   'Medium', 'Data Structures', ['trees'], 3],
  ['Dijkstra versus BFS for shortest path', 'When would you use each?',
   'BFS gives the shortest path when every edge costs the same, because it explores in order of hop count. Dijkstra generalises that to weighted graphs by using a priority queue, so it works when edges have different costs. On an unweighted graph Dijkstra degenerates to BFS.',
   'Medium', 'Algorithms', ['graphs', 'shortest-path'], 4],
  ['Binary search on a rotated array', 'Find a target in an array sorted then rotated at an unknown pivot.',
   'Compare the middle against both ends to decide which half is sorted, then decide which half the target could be in. O(log n) despite the rotation.',
   'Hard', 'Algorithms', ['searching', 'arrays'], 3],
  ['Explain quicksort and its worst case', 'How does it work, and when does it degrade?',
   'Partition around a pivot, placing smaller values left and larger right, then recurse on both halves. Average O(n log n) in place. Worst case O(n squared) when the pivot is always the smallest or largest, which is what the median-of-three or introsort pivot selection exists to avoid.',
   'Medium', 'Algorithms', ['sorting'], 4],

  // ---- databases
  ['What is a normal form, and why 3NF?', 'Explain normalisation and its purpose.',
   'Normalisation removes redundancy so an update touches one row. 1NF makes every value atomic. 2NF removes partial dependency on a composite key. 3NF removes transitive dependency, so a non-key column depends on the key, the whole key and nothing else. Denormalisation is then a deliberate choice for read-heavy reporting.',
   'Medium', 'Databases', ['normalization', 'theory'], 5],
  ['What is a database index and when does it hurt?', 'Explain B-tree indexes and their cost.',
   'A B-tree index keeps keys ordered so lookups become O(log n) instead of a full scan. It costs extra write time, because every insert and delete has to maintain the tree, and extra memory and disk. It also stops helping once a query matches most of the table, because then a sequential scan is cheaper.',
   'Medium', 'Databases', ['indexes', 'performance'], 5],
  ['Explain ACID with an example each', 'What does each letter guarantee?',
   'Atomicity: the transfer either happens or it does not. Consistency: constraints hold before and after. Isolation: concurrent transactions do not see each other’s partial work. Durability: a committed change survives a crash. The classic example is transferring money between accounts, which needs all four to be trustworthy.',
   'Medium', 'Databases', ['transactions', 'theory'], 5],
  ['What is a deadlock, and how do you prevent it?', 'Name the four necessary conditions and the approaches.',
   'A deadlock needs mutual exclusion, hold and wait, no preemption and circular wait, all at once. Prevention breaks one condition by forcing ordering or denying hold-and-wait. Avoidance, as in the banker’s algorithm, admits a request only if a safe state remains. Detection allows them and then breaks the cycle, via a wait-for graph. Recovery simply kills a victim.',
   'Medium', 'Databases', ['deadlock', 'transactions'], 4],
  ['Why can’t two tables both have a foreign key to the same column?', 'Explain the referencing and referenced sides.',
   'One side is referenced and the other references. If both referenced each other, inserting either row would need the other to exist first. The resolution is a deferred constraint check, or removing one constraint in favour of an application-level rule.',
   'Hard', 'Databases', ['foreign-keys', 'theory'], 2],

  // ---- operating systems
  ['Process versus thread, and which to use?', 'Give the practical difference, not just the textbook one.',
   'A process has its own address space and its own file descriptors. A thread shares both with the others in its process. So threads are cheaper to create and can pass data without copying, but one bad memory access in a thread corrupts the whole process. Use processes for isolation and untrusted work, threads for shared-memory work in one address space.',
   'Medium', 'Operating Systems', ['processes', 'threads'], 5],
  ['Explain paging and why it exists', 'What problem does paging solve, and what is the cost?',
   'Paging gives a process a virtual address space larger than physical memory, divided into fixed-size pages mapped onto frames. It solves external fragmentation, which paging avoids entirely. The cost is address translation on every memory access, mitigated by the TLB, plus the possibility of a page fault when a page is not resident.',
   'Medium', 'Operating Systems', ['memory', 'paging'], 5],
  ['What is a page fault and is it always bad?', 'Explain the sequence.',
   'When a page is not in the TLB, the MMU raises a fault, the OS consults the page table, and if the page is not resident it loads it from disk before restarting the instruction. That is a normal, expected path, not an error. It is only "bad" when it happens so often that you spend more time faulting than computing, which is thrashing.',
   'Medium', 'Operating Systems', ['paging', 'memory'], 4],
  ['Explain the difference between a mutex and a semaphore', 'What is each for?',
   'A mutex is a lock with one owner: the thread that takes it must be the thread that releases it, and it usually also has priority inheritance. A semaphore is a counter, so it admits up to N holders at once, and any thread may release it. A mutex is mutual exclusion; a semaphore is counting.',
   'Easy', 'Operating Systems', ['concurrency', 'threads'], 5],
  ['What causes context switching, and what does it cost?', 'When does the OS switch a process?',
   'On a timer interrupt, a blocking system call, a page fault, or a voluntary yield. The cost is saving and restoring registers and the page table, and evicting the TLB and cache, so the cost is dominated by cache disruption rather than by the instructions themselves.',
   'Medium', 'Operating Systems', ['processes', 'scheduling'], 4],

  // ---- networking
  ['What happens when you type a URL and press Enter?', 'Walk the whole path.',
   'The browser resolves the hostname, usually cached in the resolver cache. It opens a TCP connection, a three-way handshake, unless it is HTTP over TLS where the handshake is carried inside. The browser sends the request, the server responds, and any further assets are fetched over the same or new connections. DNS, TCP, TLS, HTTP, then content rendering.',
   'Medium', 'Networking', ['http', 'tcp', 'dns'], 5],
  ['Explain the TCP three-way handshake', 'Why three messages and not two?',
   'SYN, SYN-ACK, ACK. Two would leave the server unsure whether its SYN-ACK reached the client, so it could not tell a real connection from one where the client never heard back. Three messages let both sides confirm the other has received, so both can commit sequence numbers safely.',
   'Medium', 'Networking', ['tcp'], 5],
  ['What is the difference between TCP and UDP?', 'Give a case for each.',
   'TCP gives reliable, ordered delivery with congestion control and flow control, at the cost of handshakes and retransmission. UDP is a bare datagram: no guarantee of arrival, no ordering, and no retransmission, but no setup either. Use TCP for HTTP and file transfer, UDP for live video, voice and DNS lookups, where a late packet is worse than a lost one.',
   'Easy', 'Networking', ['tcp', 'udp'], 5],
  ['What is DNS and how is it hierarchical?', 'Explain the resolution path.',
   'DNS maps names to addresses through a hierarchy: the resolver asks a root server, which refers it to a TLD server, which refers it to the authoritative server for the domain. Responses are cached at every level with a TTL, so most lookups never leave the local resolver.',
   'Easy', 'Networking', ['dns'], 4],
  ['Difference between a hub, a switch and a router?', 'At which layer does each work?',
   'A hub repeats traffic to every port and works at layer 1. A switch learns MAC addresses per port and forwards frames, layer 2, so each port gets its own collision domain. A router forwards packets between different networks using IP addresses, layer 3, so each interface is its own broadcast domain.',
   'Easy', 'Networking', ['devices'], 4],

  // ---- object oriented and general
  ['What is the difference between an abstract class and an interface?', 'When would you use each?',
   'An abstract class can hold state and implementation and is inherited. An interface describes a contract and, in most languages, a type may implement several. Use an abstract class for a shared base with common code, an interface for a capability that unrelated classes should also have.',
   'Easy', 'Object Oriented', ['oop'], 4],
  ['Explain SOLID with one example each', 'Name the five principles.',
   'Single responsibility: a class changes for one reason. Open/closed: open to extension, closed to modification. Liskov: a subclass must be usable wherever the parent is. Interface segregation: keep interfaces small. Dependency inversion: depend on abstractions, not concrete classes.',
   'Hard', 'Software Engineering', ['solid', 'design'], 3],
  ['What is a race condition?', 'How do you avoid one in a web application?',
   'Two threads touching shared state at the same time, so the result depends on timing. In Node.js the event loop runs your handlers on one thread, so the danger is async interleaving rather than true parallelism: an await in the middle of a read-modify-write lets another request in between. Fix it with a transaction, a row lock, or an atomic database operation.',
   'Medium', 'Concurrency', ['concurrency', 'node'], 4],
  ['Explain REST and what makes an API RESTful', 'Give the constraints.',
   'Resources are nouns addressed by URL, the method carries the action, the API is stateless, responses are cacheable, and a uniform interface means the same representation everywhere. The common failure is putting verbs in URLs, which turns the URL into a procedure rather than a resource.',
   'Medium', 'Web Development', ['rest', 'api'], 4],

  // ---- situational and project
  ['Tell me about a bug you found in your own project', 'What was the process?',
   'Give a real one from this project. The blank optional field bug is a good example: a form sent an empty string for a field the user had left alone, express-validator’s optional() does not skip empty strings, so 91 validation chains rejected the form with a 400. The hard part was that no test failed, because the tests built their own payloads and could not notice an omission in them.',
   'Medium', 'Behavioural', ['project', 'debugging'], 5],
  ['How would you test a payment flow?', 'What would you actually assert?',
   'Walk the whole lifecycle, asserting the balance at every step rather than only the end state. Fund, confirm the payer’s available drops and their locked rises by exactly the amount, confirm release pays the payee and clears the hold, and confirm a second release pays nobody. Then the negative cases: releasing without submitted work, funding twice, withdrawing the same money twice, and overdrawing. Each of those caught a real bug here.',
   'Hard', 'Behavioural', ['testing', 'project'], 4],
  ['Why should escrow hold the money rather than paying on completion?', 'What does it protect?',
   'It protects the person who has already done the work. If payment waited for completion, a company could take the deliverable and simply not pay, and the student would have no leverage. Holding the funds first means the student is paid for work already done, and the company holds the risk instead.',
   'Medium', 'Behavioural', ['project', 'design'], 4]
];

async function main() {
  const db = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();

  const up = (await db.query("select id from public.users where role='admin' order by created_at limit 1")).rows[0]
    || (await db.query('select id from public.users order by created_at limit 1')).rows[0];
  const uploader = up.id;

  // ---- approve the existing entries
  const approved = await db.query(
    'update public.resources set is_approved = true where is_approved = false returning id'
  );
  console.log('  approved ' + approved.rowCount + ' existing resource(s) that were invisible');

  // ---- resources
  let addedRes = 0;
  for (const [title, type, subject, description, tags, url] of RESOURCES) {
    const exists = await db.query('select id from public.resources where title=$1', [title]);
    if (exists.rows.length) continue;
    await db.query(
      `insert into public.resources (uploader_id, title, description, resource_type, external_url, tags, subject, is_approved)
       values ($1,$2,$3,$4,$5,$6,$7,true)`,
      [uploader, title, description, type, url || null, tags, subject]
    );
    addedRes++;
  }
  console.log('  added ' + addedRes + ' resource(s)');

  // ---- interview questions
  let addedQ = 0;
  for (const [title, question, answer, level, category, tags, freq] of QUESTIONS) {
    const exists = await db.query('select id from public.interview_questions where title=$1', [title]);
    if (exists.rows.length) continue;
    await db.query(
      `insert into public.interview_questions (title, question, sample_answer, difficulty_level, category, tags, asked_frequency)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [title, question, answer, level, category, tags, freq]
    );
    addedQ++;
  }
  console.log('  added ' + addedQ + ' interview question(s)');

  const r = await db.query('select count(*)::int n from public.resources where is_approved = true');
  const q = await db.query('select count(*)::int n from public.interview_questions');
  console.log('\n  approved resources now visible : ' + r.rows[0].n);
  console.log('  interview questions            : ' + q.rows[0].n);

  await db.end();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('  seed failed: ' + err.message);
    process.exit(1);
  });
