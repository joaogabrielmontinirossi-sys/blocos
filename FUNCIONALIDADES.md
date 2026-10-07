# Funcionalidades do Blocos

## Estrutura

1. Obras: o projeto inteiro, com entrega final
2. Módulos: partes da obra com entrega intermediária
3. Blocos com cinco campos obrigatórios (ação, tipo, tamanho, entrada, saída)
4. Seis tipos de bloco, um por cor
5. Três tamanhos de fábrica (P, M, G)
6. Regra de ouro: nada maior que o maior tamanho
7. Encaixe: um bloco pode depender de vários outros
8. Proteção contra encaixe circular

## Estados do bloco

9. Na caixa (falta uma entrada)
10. Liberado
11. Montando
12. Encaixado
13. Travado, com o motivo anotado
14. Selo de atrasado quando o dia marcado passou

## Cartão do bloco

15. Cartão com frente (o contrato) e verso (o miolo)
16. Notas no verso
17. Checklist de itens no verso
18. Energia que o bloco pede (pouca, média, muita)
19. Prazo próprio do bloco
20. Etiquetas livres
21. Link anexado
22. Bloco-chave (estrela)
23. Fixar no topo da bancada
24. Rotina: o bloco volta no dia ou na semana seguinte ao ser encaixado
25. Cronômetro do tempo real de montagem
26. Comparação entre tempo real e estimado
27. História do bloco (criado, quebrado, montando, encaixado)
28. Aviso de quais blocos ele libera ao ser encaixado
29. Duplicar bloco
30. Subir e descer dentro do módulo
31. Compartilhar ou copiar o cartão como texto
32. Quebrar em 2 a 6 partes já encadeadas
33. Fundir com o bloco seguinte, se a soma couber no maior tamanho
34. Tipo adivinhado pelo verbo da ação
35. Entrada preenchida sozinha com a saída dos blocos anteriores
36. Marcas na peça: estrela, fixado, rotina, checklist, energia e prazo

## Montar: bancada e dia

37. Bancada só com blocos liberados
38. Bancada agrupada por cor
39. Bancada agrupada por obra
40. Bancada por prioridade e prazo
41. Bancada por tamanho
42. Filtro por obra
43. Filtro "pouca energia"
44. Captura rápida de bloco em uma linha
45. Sintaxe da captura: #tipo, @tamanho, ! (chave), > saída
46. Outras #palavras viram etiquetas
47. Caixa de avulsos para blocos sem obra
48. Dia com vagas fixas por tamanho
49. Arrastar da bancada para o dia e de volta
50. Agendar por toque (celular)
51. Recusa quando o tamanho está lotado
52. Navegar entre dias e voltar para hoje
53. Medidor do dia colorido por tipo (balanço de cores)
54. Visão do dia por cores, com as vagas restantes
55. Sugerir meu dia: preenche as vagas pelos mais urgentes
56. "O que faço agora?": aponta o próximo bloco
57. Empurrar pendentes para o dia seguinte
58. Limpar o dia
59. Fechar o dia, com resumo do que foi entregue
60. Aviso quando o dia está vazio e há blocos liberados
61. Indicação de dia de folga

## Execução

62. Inspeção: confirmar que a saída existe antes de encaixar
63. Aviso de checklist aberto na inspeção
64. Modo foco em tela cheia
65. Contagem regressiva com a peça enchendo
66. Mais 5 minutos no foco
67. Checklist marcável dentro do foco
68. Limite de blocos montando ao mesmo tempo
69. Pausar guardando o tempo já gasto
70. Desfazer um encaixe
71. Título da aba mostra o bloco em montagem
72. Aviso do sistema quando o tempo do bloco acaba

## Kanban de blocos

73. Kanban por estado
74. Kanban por cor
75. Kanban por tamanho
76. Kanban por obra
77. Kanban da semana, com a carga de cada dia
78. Kanban por energia
79. Kanban por módulo, dentro de cada obra
80. Arrastar entre colunas muda o bloco de verdade (inicia, inspeciona, trava, agenda, troca de obra)
81. Busca em ação, etiquetas, entrada, saída e notas
82. Filtro por obra
83. Contagem e minutos por coluna
84. Limite de montagem visível na coluna

## Obras

85. Pilha que cresce a cada bloco encaixado
86. Progresso real em blocos e em horas
87. Prazo com aviso de cabe ou não cabe na capacidade
88. Contagem regressiva do prazo
89. Previsão de término com a capacidade cheia
90. Previsão de término no seu ritmo real das últimas duas semanas
91. Campo de entrega final
92. Ícone da obra
93. Pausar a obra (os blocos saem da bancada)
94. Arquivar e desarquivar
95. Duplicar a obra
96. Desmontar por texto: uma linha por bloco, # abre módulo
97. Copiar a obra como texto com caixas de marcação
98. Manual de montagem: passos numerados e o que pode ser feito em paralelo
99. Caminho crítico destacado
100. Barra de progresso por módulo
101. Recolher e abrir módulos
102. Reordenar módulos
103. Bloco rápido dentro do módulo, já encaixado no anterior
104. Nomes editados no lugar
105. Destaque de módulo entregue

## Plantas

106. Plantas: sequências de blocos reutilizáveis
107. Seis plantas de fábrica (trabalho acadêmico, prova, peça jurídica, apresentação, software, revisão semanal)
108. Salvar qualquer obra como planta, com os encaixes
109. Checagem de prazo e previsão antes de criar a obra
110. Duplicar planta
111. Exportar planta em arquivo
112. Importar planta de arquivo
113. Renomear e excluir plantas

## Muro

114. Muro: cada bloco encaixado vira um tijolo
115. Sequência de dias com encaixe
116. Maior sequência e recorde de blocos num dia
117. Níveis de construtor, de Aprendiz a Arquiteto
118. Meta semanal com anel de progresso
119. Mapa de dezesseis semanas
120. Quinze conquistas

## Diagnóstico semanal

121. Concluídos por tipo
122. Blocos quebrados na semana
123. Cor que mais acumula e onde está o gargalo
124. Comparação com a semana anterior
125. Régua: tempo real sobre o estimado, por tipo
126. Hora do dia em que você mais encaixa
127. Concluídos por tamanho
128. Obras em risco de prazo
129. Lista de blocos travados e os motivos
130. Navegar por semanas passadas
131. Copiar o relatório da semana

## Personalização

132. Tipos editáveis: nome, cor e verbos
133. Criar e excluir tipos
134. Quatro paletas prontas
135. Tamanhos editáveis: sigla, nome e minutos
136. Criar e excluir tamanhos
137. Três ritmos prontos (padrão, pomodoro, curto)
138. Capacidade do dia por tamanho
139. Dias de trabalho da semana
140. Tema claro, escuro ou automático
141. Quatro estilos de peça (pinos, pinos redondos, lisas, contorno)
142. Peças compactas
143. Ligar e desligar animações, sons e vibração

## Animações e sensações

144. Encaixe: a peça cai e assenta
145. Liberação: o bloco que saiu da caixa pulsa
146. Tijolo novo caindo na pilha e no muro
147. Confete de peças ao entregar uma obra
148. Tremor quando o bloco não cabe
149. Quebra: as partes se abrem
150. Pulso contínuo no bloco em montagem
151. Transição entre abas
152. Virada do cartão
153. Brilho de módulo entregue
154. Entrada de bloco novo ou movido
155. Sons próprios (encaixe, liberação, recusa, quebra, entrega)
156. Vibração no celular

## Sistema

157. Sincronização por pasta do Google Drive (Windows)
158. Sincronização pela conta Google (Windows, site e celular)
159. Mescla por registro, com exclusões propagadas
160. Backup: exportar e importar
161. Site instalável que abre sem internet
162. Programa de Windows em um arquivo só
163. Atalhos de teclado
164. Manual do método dentro do app
165. Respeita a preferência de reduzir movimento
166. Obra de exemplo que some ao sincronizar com dados reais
