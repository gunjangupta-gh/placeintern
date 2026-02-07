import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Input,
  Button,
  Collapse,
  Tag,
  Typography,
  Space,
  Spin,
  Empty,
  Divider,
} from 'antd';
import { toast } from 'react-hot-toast';
import {
  SearchOutlined,
  QuestionCircleOutlined,
  BookOutlined,
  LikeOutlined,
  DislikeOutlined,
  EyeOutlined,
  FireOutlined,
} from '@ant-design/icons';
import { helpSupportService, SUPPORT_CATEGORIES, TICKET_PRIORITY } from '../../services/helpSupport.service';
import { useAuth } from '../../hooks/useAuth';

const { Text, Paragraph } = Typography;

// Enhanced markdown-like text to HTML converter with table support
const renderMarkdown = (text) => {
  if (!text) return '';

  // Split into paragraphs first
  const paragraphs = text.split(/\n\n+/);

  const processedParagraphs = paragraphs.map(para => {
    // Check if this is a table (contains | characters on multiple lines)
    const lines = para.split('\n');
    const isTable = lines.length >= 2 &&
      lines[0].includes('|') &&
      lines[1].includes('|') &&
      lines.some(l => l.match(/^[\s|:-]+$/)); // Has separator row

    if (isTable) {
      const tableLines = lines.filter(l => l.trim() && !l.match(/^[\s|:-]+$/));
      if (tableLines.length > 0) {
        const headerCells = tableLines[0].split('|').map(c => c.trim()).filter(c => c);
        const bodyRows = tableLines.slice(1);

        let tableHtml = `<div class="overflow-x-auto my-4"><table class="w-full text-sm border-collapse">`;
        tableHtml += `<thead><tr class="bg-background-tertiary">`;
        headerCells.forEach(cell => {
          tableHtml += `<th class="text-left px-3 py-2 font-semibold text-text-primary border-b border-border">${cell}</th>`;
        });
        tableHtml += `</tr></thead><tbody>`;

        bodyRows.forEach((row, idx) => {
          const cells = row.split('|').map(c => c.trim()).filter(c => c);
          const rowClass = idx % 2 === 1 ? 'bg-background-secondary/30' : '';
          tableHtml += `<tr class="${rowClass}">`;
          cells.forEach(cell => {
            tableHtml += `<td class="px-3 py-2 text-text-secondary border-b border-border/50">${cell}</td>`;
          });
          tableHtml += `</tr>`;
        });

        tableHtml += `</tbody></table></div>`;
        return tableHtml;
      }
    }

    let html = para
      // Escape HTML entities
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Bold text with **
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-text-primary font-semibold">$1</strong>')
      // Code/monospace with backticks
      .replace(/`([^`]+)`/g, '<code class="bg-background-tertiary px-1.5 py-0.5 rounded text-primary text-sm font-mono">$1</code>');

    // Check if this paragraph is a list
    const listLines = html.split('\n');
    const isBulletList = listLines.every(line => line.trim() === '' || line.trim().startsWith('•') || line.trim().startsWith('-'));
    const isNumberedList = listLines.every(line => line.trim() === '' || /^\d+\./.test(line.trim()));

    if (isBulletList && listLines.some(line => line.trim().startsWith('•') || line.trim().startsWith('-'))) {
      const listItems = listLines
        .filter(line => line.trim())
        .map(line => {
          const content = line.replace(/^[•-]\s*/, '').trim();
          return `<li class="mb-1.5 pl-1">${content}</li>`;
        })
        .join('');
      return `<ul class="list-disc list-outside ml-5 my-3 space-y-1 text-text-secondary">${listItems}</ul>`;
    }

    if (isNumberedList && listLines.some(line => /^\d+\./.test(line.trim()))) {
      const listItems = listLines
        .filter(line => line.trim())
        .map(line => {
          const content = line.replace(/^\d+\.\s*/, '').trim();
          return `<li class="mb-1.5 pl-1">${content}</li>`;
        })
        .join('');
      return `<ol class="list-decimal list-outside ml-5 my-3 space-y-1 text-text-secondary">${listItems}</ol>`;
    }

    // Check if it's a header-like line (ends with :)
    if (html.trim().endsWith(':') && !html.includes('<li>') && html.length < 100) {
      return `<p class="font-semibold text-text-primary mt-4 mb-2">${html}</p>`;
    }

    // Regular paragraph
    html = html.replace(/\n/g, '<br/>');
    return `<p class="mb-3 text-text-secondary leading-relaxed">${html}</p>`;
  });

  return processedParagraphs.join('');
};

const HelpCenter = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [faqs, setFaqs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [popularFaqs, setPopularFaqs] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [activeKey, setActiveKey] = useState(null);

  // Fetch FAQs and categories
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [faqsData, categoriesData, popularData] = await Promise.all([
        helpSupportService.getPublishedFAQs(),
        helpSupportService.getFAQCategories(),
        helpSupportService.getPopularFAQs(5),
      ]);
      setFaqs(faqsData);
      setCategories(categoriesData);
      setPopularFaqs(popularData);
    } catch (error) {
      console.error('Failed to fetch FAQs:', error);
      toast.error('Failed to load help articles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Search FAQs
  const handleSearch = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setSearchResults(null);
      return;
    }

    setSearching(true);
    try {
      const results = await helpSupportService.searchFAQs(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Failed to search FAQs:', error);
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  // Filter FAQs by category
  const filteredFAQs = selectedCategory
    ? faqs.filter(faq => faq.category === selectedCategory)
    : faqs;

  // Display FAQs (search results or filtered)
  const displayFAQs = searchResults !== null ? searchResults : filteredFAQs;

  // Mark FAQ as helpful
  const handleMarkHelpful = async (id) => {
    try {
      await helpSupportService.markFAQHelpful(id);
      toast.success('Thanks for your feedback!');
      // Update local state to reflect the change
      setFaqs(prev => prev.map(faq =>
        faq.id === id ? { ...faq, helpfulCount: (faq.helpfulCount || 0) + 1 } : faq
      ));
    } catch (error) {
      console.error('Failed to mark FAQ helpful:', error);
    }
  };

  // Handle vote (helpful/not helpful)
  const handleVote = async (id, type) => {
    if (type === 'up') {
      await handleMarkHelpful(id);
    } else {
      // For 'down' votes, just show feedback message (no backend tracking for unhelpful)
      toast('ℹ️ Thanks for your feedback! We\'ll work to improve this article.', { icon: 'ℹ️' });
    }
  };

  // Category color helper
  const getCategoryInfo = (category) => {
    return SUPPORT_CATEGORIES[category] || { label: category, color: 'default' };
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" tip="Loading help center..." />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-background-secondary min-h-screen">
      <div className="max-w-7xl mx-auto !space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">FAQ</h1>
            <Text className="text-text-tertiary text-sm">Find answers to frequently asked questions</Text>
          </div>
        </div>

        {/* Search Card */}
        <Card className="rounded-xl border-border shadow-sm" styles={{ body: { padding: '16px' } }}>
          <Input
            size="large"
            placeholder="Search for help articles..."
            prefix={<SearchOutlined className="text-text-tertiary" />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
            className="rounded-lg h-11 border-border"
          />
        </Card>

        <Row gutter={[16, 16]}>
          {/* Categories Sidebar */}
          <Col xs={24} md={6}>
            <Card
              className="rounded-xl border-border shadow-sm !mb-3"
              styles={{ body: { padding: '12px' } }}
            >
              <Text className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-3 block">
                <BookOutlined className="mr-1.5" />Categories
              </Text>
              <Space direction="vertical" style={{ width: '100%' }} size={4}>
                <Button
                  type={selectedCategory === null ? 'primary' : 'text'}
                  block
                  size="small"
                  onClick={() => setSelectedCategory(null)}
                  className={`rounded-lg text-left justify-start ${selectedCategory === null ? 'font-medium' : 'text-text-secondary'}`}
                >
                  All Articles ({faqs.length})
                </Button>
                {categories.map((cat) => (
                  <Button
                    key={cat.category}
                    type={selectedCategory === cat.category ? 'primary' : 'text'}
                    block
                    size="small"
                    onClick={() => setSelectedCategory(cat.category)}
                    className={`rounded-lg text-left justify-start ${selectedCategory === cat.category ? 'font-medium' : 'text-text-secondary'}`}
                  >
                    {cat.label} ({cat.count})
                  </Button>
                ))}
              </Space>
            </Card>

            {/* Popular Articles */}
            {popularFaqs.length > 0 && (
              <Card
                className="mt-3 rounded-xl border-border shadow-sm"
                styles={{ body: { padding: '12px' } }}
              >
                <Text className="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-3 block">
                  <FireOutlined className="mr-1.5 text-orange-500" />Popular
                </Text>
                <Space direction="vertical" style={{ width: '100%' }} size={0}>
                  {popularFaqs.slice(0, 5).map((faq, index) => (
                    <div
                      key={faq.id}
                      className="py-2 border-b border-border/50 last:border-0 cursor-pointer hover:bg-background-secondary/30 -mx-3 px-3 transition-colors"
                      onClick={() => {
                        setSelectedCategory(null);
                        setSearchQuery('');
                        setSearchResults(null);
                        setActiveKey(faq.id);
                        setTimeout(() => {
                          document.getElementById(`faq-${faq.id}`)?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center',
                          });
                        }, 100);
                      }}
                    >
                      <Text className="text-text-primary text-xs leading-snug line-clamp-2 hover:text-primary">
                        {index + 1}. {faq.title}
                      </Text>
                      <Text className="text-text-tertiary text-[10px] flex items-center gap-1 mt-0.5">
                        <EyeOutlined /> {faq.viewCount}
                      </Text>
                    </div>
                  ))}
                </Space>
              </Card>
            )}
          </Col>

          {/* FAQ Articles */}
          <Col xs={24} md={18}>
            {searching ? (
              <div className="text-center py-12">
                <Spin tip="Searching..." />
              </div>
            ) : displayFAQs.length === 0 ? (
              <Card className="rounded-xl border-border shadow-sm text-center py-12">
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span className="text-text-secondary">
                      {searchQuery ? `No articles found for "${searchQuery}"` : 'No articles available'}
                    </span>
                  }
                />
              </Card>
            ) : (
              <>
                {searchResults !== null && (
                  <Text className="text-text-tertiary block mb-3 text-sm">
                    Found {searchResults.length} results for "{searchQuery}"
                  </Text>
                )}

                <Card className="rounded-xl border-border shadow-sm overflow-hidden" styles={{ body: { padding: 0 } }}>
                  <Collapse
                    accordion
                    activeKey={activeKey}
                    onChange={(key) => setActiveKey(key)}
                    expandIconPosition="end"
                    ghost
                    className="custom-collapse"
                    items={displayFAQs.map((faq) => ({
                      key: faq.id,
                      id: `faq-${faq.id}`,
                      className: "border-b border-border last:border-0 hover:bg-background-secondary/30 transition-colors",
                      label: (
                        <div className="py-2" id={`faq-${faq.id}`}>
                          <div className="flex items-start gap-2">
                            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <QuestionCircleOutlined className="text-primary text-xs" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <Text strong className="text-text-primary text-sm block mb-1 leading-snug">{faq.title}</Text>
                              <Space size={6} wrap>
                                <Tag color={getCategoryInfo(faq.category).color} className="rounded border-0 text-[10px] m-0">
                                  {getCategoryInfo(faq.category).label}
                                </Tag>
                                <Text className="text-text-tertiary text-[10px] flex items-center gap-1">
                                  <EyeOutlined /> {faq.viewCount}
                                </Text>
                                <Text className="text-text-tertiary text-[10px] flex items-center gap-1">
                                  <LikeOutlined /> {faq.helpfulCount || 0}
                                </Text>
                              </Space>
                            </div>
                          </div>
                        </div>
                      ),
                      children: (
                        <div className="pb-4 pl-9 pr-4">
                          {faq.summary && (
                            <div className="bg-primary/5 border-l-3 border-primary rounded-r-lg p-2.5 mb-3">
                              <Text className="text-text-secondary text-xs italic">{faq.summary}</Text>
                            </div>
                          )}
                          <div
                            className="faq-content text-text-secondary text-sm leading-relaxed mb-4"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(faq.content) }}
                          />

                          <Divider className="my-3 border-border/50" />

                          <div className="flex items-center justify-between">
                            <Text className="text-[10px] text-text-tertiary">Was this helpful?</Text>
                            <Space size={4}>
                              <Button
                                size="small"
                                icon={<LikeOutlined />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleVote(faq.id, 'up');
                                }}
                                className="rounded text-xs hover:text-success hover:border-success"
                              >
                                Yes
                              </Button>
                              <Button
                                size="small"
                                icon={<DislikeOutlined />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleVote(faq.id, 'down');
                                }}
                                className="rounded text-xs hover:text-error hover:border-error"
                              >
                                No
                              </Button>
                            </Space>
                          </div>
                        </div>
                      )
                    }))}
                  />
                </Card>
              </>
            )}
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default HelpCenter;
